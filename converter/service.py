"""
Chat Converter Orchestration Service.
Coordinates parsers, pipelines, domain resolution, and view builders.
"""

import re
import json
import shutil
from pathlib import Path
from typing import Optional, List, Dict
from urllib.parse import quote
from .domain.models import ChatSession, ChatMessage
from .domain.enums import Direction, DateOrder, MessageType
from .parsers.factory import ParserFactory
from .pipeline.media import MediaResolver
from .renderers.builder import ChatHtmlBuilder


class ChatConverterService:
    """Enterprise service coordinating the end-to-end chat archival conversion."""

    def __init__(self, parser_factory: Optional[ParserFactory] = None):
        self.parser_factory = parser_factory or ParserFactory()

    def convert(
        self,
        folder_path: Path,
        output_filename: str = "chat.html",
        you_name: Optional[str] = None,
        embed_images: bool = False,
        assets_dir: Optional[Path] = None,
        create_launcher: bool = True,
        dist_dir: Optional[Path] = None,
        create_zip: bool = False
    ) -> Path:
        source_folder = Path(folder_path)
        if not source_folder.exists():
            raise FileNotFoundError(f"Folder '{source_folder}' does not exist.")

        # Determine active working directory (dist vs in-place)
        if dist_dir:
            dist_path = Path(dist_dir)
            dist_path.mkdir(parents=True, exist_ok=True)
            active_folder = dist_path / source_folder.name
            active_folder.mkdir(parents=True, exist_ok=True)
            self._copy_chat_assets(source_folder, active_folder)
        else:
            dist_path = None
            active_folder = source_folder

        # 1. Locate chat text file
        chat_file = self._find_chat_file(active_folder)

        # 2. Select strategy & parse messages
        parser = self.parser_factory.get_parser(chat_file)
        raw_messages = parser.parse(chat_file)

        # 3. Detect date convention (Month-first vs Day-first)
        date_order = self._detect_date_order(raw_messages)

        # 4. Resolve media attachments
        media_resolver = MediaResolver(active_folder, embed_images=embed_images)
        processed_messages: List[ChatMessage] = []

        senders: Dict[str, int] = {}
        for msg in raw_messages:
            if msg.sender and msg.type == MessageType.MESSAGE:
                senders[msg.sender] = senders.get(msg.sender, 0) + 1

            attachment, clean_text = media_resolver.resolve(msg.text)
            processed_messages.append(
                ChatMessage(
                    raw_date=msg.raw_date,
                    raw_time=msg.raw_time,
                    sender=msg.sender,
                    text=clean_text,
                    type=msg.type,
                    attachment=attachment,
                    is_deleted=msg.is_deleted,
                    is_call=msg.is_call,
                    call_description=msg.call_description,
                    is_edited=msg.is_edited
                )
            )

        # 5. Resolve Conversational Direction (You vs Other)
        resolved_you, resolved_contact = self._resolve_participants(
            source_folder, senders, you_name, chat_file=chat_file, raw_messages=raw_messages
        )

        final_messages: List[ChatMessage] = []
        for msg in processed_messages:
            direction = Direction.SENT if msg.sender == resolved_you else Direction.RECEIVED
            final_messages.append(
                ChatMessage(
                    raw_date=msg.raw_date,
                    raw_time=msg.raw_time,
                    sender=msg.sender,
                    text=msg.text,
                    type=msg.type,
                    attachment=msg.attachment,
                    is_deleted=msg.is_deleted,
                    is_call=msg.is_call,
                    call_description=msg.call_description,
                    direction=direction,
                    is_edited=msg.is_edited
                )
            )

        session = ChatSession(
            title=f"Chat with {resolved_contact}",
            contact_name=resolved_contact,
            you_name=resolved_you,
            messages=final_messages,
            date_order=date_order,
            sender_counts=senders
        )

        # 6. Load Templates & Styles
        template_str, css_str, js_str, lottie_str = self._load_assets(assets_dir or Path(__file__).parent.parent)

        # 7. Build HTML
        builder = ChatHtmlBuilder(media_resolver)
        html_output = builder.build(session, template_str, css_str, js_str, lottie_str)

        # 8. Write Output
        output_path = active_folder / output_filename
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_output)

        # 9. Create Outer Referral Launcher HTML
        if create_launcher:
            launcher_target_dir = dist_path if dist_path else active_folder.parent
            if launcher_target_dir and launcher_target_dir.exists():
                try:
                    self._create_launcher(
                        target_dir=launcher_target_dir,
                        folder_name=active_folder.name,
                        output_filename=output_filename,
                        contact_name=session.contact_name,
                        create_index=(dist_path is not None)
                    )
                except Exception:
                    pass  # Non-blocking if directory is read-only

        # 10. Optional Zip Archive Creation
        if create_zip and dist_path:
            shutil.make_archive(
                str(dist_path.resolve()),
                'zip',
                root_dir=str(dist_path.parent.resolve()),
                base_dir=dist_path.name
            )

        return output_path

    def _copy_chat_assets(self, source: Path, destination: Path) -> None:
        """Copies chat files and media attachments into the distribution folder."""
        if source.resolve() == destination.resolve():
            return
        destination.mkdir(parents=True, exist_ok=True)
        ignored_names = {'.ds_store', '__pycache__', 'thumbs.db'}
        for item in source.iterdir():
            if item.name.lower() in ignored_names:
                continue
            if item.is_file():
                dest_file = destination / item.name
                if dest_file.exists() and dest_file.stat().st_size == item.stat().st_size:
                    if dest_file.suffix.lower() == '.webp':
                        MediaResolver._ensure_webp_infinite_loop(dest_file)
                    continue
                shutil.copy2(item, dest_file)
                if dest_file.suffix.lower() == '.webp':
                    MediaResolver._ensure_webp_infinite_loop(dest_file)
            elif item.is_dir():
                dest_subdir = destination / item.name
                shutil.copytree(
                    item,
                    dest_subdir,
                    dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns('.DS_Store', '__pycache__')
                )

    def _create_launcher(
        self,
        target_dir: Path,
        folder_name: str,
        output_filename: str,
        contact_name: Optional[str] = None,
        create_index: bool = False
    ) -> List[Path]:
        launcher_filename = "افتح المحادثة هنا - Open Chat Here.html"
        launcher_path = target_dir / launcher_filename

        relative_target = f"{folder_name}/{output_filename}"
        encoded_target = quote(relative_target)
        title = f"محادثة {contact_name}" if contact_name else "محادثة واتساب"

        content = f'''<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Immediate Redirect using URL-encoded relative path -->
    <meta http-equiv="refresh" content="0; url={encoded_target}">
    <title>فتح {title}</title>
    <style>
        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}
        :root {{
            --bg-canvas: #efeae2;
            --card-bg: #ffffff;
            --title-color: #111b21;
            --sub-color: #667781;
            --card-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
        }}
        @media (prefers-color-scheme: dark) {{
            :root {{
                --bg-canvas: #0b141a;
                --card-bg: #111b21;
                --title-color: #e9edef;
                --sub-color: #8696a0;
                --card-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
            }}
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: var(--bg-canvas);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            text-align: center;
            padding: 20px;
        }}
        .launcher-card {{
            background: var(--card-bg);
            padding: 36px 32px;
            border-radius: 20px;
            box-shadow: var(--card-shadow);
            max-width: 440px;
            width: 100%;
        }}
        .avatar {{
            width: 72px;
            height: 72px;
            border-radius: 50%;
            background: linear-gradient(135deg, #007aff, #00c6ff);
            color: #ffffff;
            font-size: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
            box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
        }}
        h1 {{
            color: var(--title-color);
            font-size: 22px;
            font-weight: 600;
            margin-bottom: 8px;
        }}
        p {{
            color: var(--sub-color);
            font-size: 14px;
            line-height: 1.5;
            margin-bottom: 24px;
        }}
        .btn-open {{
            display: inline-block;
            background: #25d366;
            color: #ffffff;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 30px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.15s, background-color 0.15s;
            box-shadow: 0 2px 8px rgba(37, 211, 102, 0.35);
        }}
        .btn-open:hover {{
            background: #1ebc57;
            transform: scale(1.02);
        }}
        .btn-open:active {{
            transform: scale(0.98);
        }}
    </style>
</head>
<body>
    <div class="launcher-card">
        <div class="avatar">💬</div>
        <h1>{title}</h1>
        <p>جاري فتح المحادثة تلقائياً في المتصفح...<br><span style="font-size:12px;opacity:0.8">Opening chat automatically...</span><br><br>إذا لم تفتح الصفحة، اضغط على الزر أدناه:</p>
        <a class="btn-open" href="{encoded_target}">
            اضغط هنا لفتح المحادثة ↗
        </a>
    </div>

    <script>
        // Automatic instantaneous redirection
        window.location.replace({json.dumps(relative_target)});
    </script>
</body>
</html>'''
        paths = [launcher_path]
        with open(launcher_path, 'w', encoding='utf-8') as f:
            f.write(content)

        if create_index:
            index_path = target_dir / "index.html"
            with open(index_path, 'w', encoding='utf-8') as f:
                f.write(content)
            paths.append(index_path)

        return paths

    def _find_chat_file(self, folder: Path) -> Path:
        txt_files = list(folder.glob('*.txt'))
        if not txt_files:
            raise FileNotFoundError(f"No .txt export file found in {folder}")

        for f in txt_files:
            if f.name.lower() == '_chat.txt':
                return f
        for f in txt_files:
            if 'chat' in f.name.lower() or 'whatsapp' in f.name.lower():
                return f
        return txt_files[0]

    def _detect_date_order(self, messages: List[ChatMessage]) -> DateOrder:
        has_day_first = False
        has_month_first = False
        for msg in messages:
            clean = re.sub(r'[\u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff]', '', msg.raw_date).strip()
            parts = re.split(r'[/.-]', clean)
            if len(parts) == 3:
                try:
                    p1, p2 = int(parts[0]), int(parts[1])
                    if p1 > 12:
                        has_day_first = True
                    if p2 > 12:
                        has_month_first = True
                except ValueError:
                    pass
        if has_month_first and not has_day_first:
            return DateOrder.MONTH_FIRST
        return DateOrder.DAY_FIRST

    def _resolve_participants(
        self,
        folder: Path,
        senders: Dict[str, int],
        explicit_you: Optional[str],
        chat_file: Optional[Path] = None,
        raw_messages: Optional[List[ChatMessage]] = None
    ) -> tuple:
        if explicit_you:
            other = next((s for s in senders if s != explicit_you), "WhatsApp Chat")
            return explicit_you, other

        # 1. WhatsApp standard export naming: "WhatsApp Chat - <Contact Name>" or "WhatsApp Chat with <Contact Name>.txt"
        search_targets = [folder.name]
        if chat_file is not None:
            search_targets.append(chat_file.stem)
            search_targets.append(chat_file.name)

        matched_contact = None
        for sender in senders:
            if any(sender in target for target in search_targets):
                matched_contact = sender
                break

        if matched_contact and len(senders) == 2:
            you = next(s for s in senders if s != matched_contact)
            return you, matched_contact

        # 2. Check for exporter-exclusive self-action phrases ("You turned...", "You deleted...", "أنت حذفت...")
        if raw_messages and len(senders) == 2:
            self_phrases = (
                "You turned ",
                "You deleted ",
                "You changed ",
                "أنت حذفت",
                "قمت ب",
            )
            for msg in raw_messages:
                if msg.sender in senders and msg.text and msg.text.startswith(self_phrases):
                    you = msg.sender
                    other = next((s for s in senders if s != you), "WhatsApp Chat")
                    return you, other

        if senders:
            # Fallback heuristic: the sender with fewer messages is 'you'
            you = min(senders, key=senders.get)
            other = next((s for s in senders if s != you), "WhatsApp Chat")
            return you, other

        return None, "WhatsApp Chat"

    def _load_assets(self, base_dir: Path) -> tuple:
        template_path = base_dir / 'template.html'
        css_path = base_dir / 'style.css'
        js_path = base_dir / 'script.js'
        lottie_path = base_dir / 'lottie.min.js'
        if not lottie_path.exists():
            lottie_path = base_dir / 'assets' / 'lottie.min.js'

        with open(template_path, 'r', encoding='utf-8') as f:
            template = f.read()
        with open(css_path, 'r', encoding='utf-8') as f:
            css = f.read()
        with open(js_path, 'r', encoding='utf-8') as f:
            js = f.read()

        lottie = ""
        if lottie_path.exists():
            with open(lottie_path, 'r', encoding='utf-8') as f:
                lottie = f.read()

        return template, css, js, lottie
