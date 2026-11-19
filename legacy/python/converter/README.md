# converter

## Overview
The `converter` package exposes the public archival conversion API via `__init__.py` and orchestrates the end-to-end WhatsApp export conversion pipeline through `ChatConverterService` in `service.py`. It coordinates `parsers` (`ParserFactory`), `pipeline` (`MediaResolver`), `domain` (`ChatMessage`, `ChatSession`, `Direction`, `DateOrder`, `MessageType`), and `renderers` (`ChatHtmlBuilder`) while handling export discovery, participant and date-order inference, template/asset loading, distribution copying, launcher generation, and optional ZIP packaging.

## Interface
- `[__init__.py:__all__]` Re-exports 18 public symbols: `ChatConverterService`, `MessageType`, `MediaType`, `Direction`, `DateOrder`, `ChatMessage`, `Attachment`, `ChatSession`, `IChatParser`, `IOSChatParser`, `AndroidChatParser`, `ParserFactory`, `MediaResolver`, `RichLinkExtractor`, `VoiceNoteComponent`, `RichLinkComponent`, `MediaCardComponent`, and `ChatHtmlBuilder`.
- `[service.py:ChatConverterService]` End-to-end orchestration service coordinating parsing, media resolution, participant/date-order inference, `ChatSession` assembly, HTML rendering, launcher creation, and optional distribution packaging.
- `[service.py:ChatConverterService.__init__]` `__init__(self, parser_factory: Optional[ParserFactory] = None)` — stores `self.parser_factory = parser_factory or ParserFactory()`.
- `[service.py:ChatConverterService.convert]` `convert(self, folder_path: Path, output_filename: str = "chat.html", you_name: Optional[str] = None, embed_images: bool = False, assets_dir: Optional[Path] = None, create_launcher: bool = True, dist_dir: Optional[Path] = None, create_zip: bool = False) -> Path` — executes the 10-step conversion workflow and returns the output HTML `Path`.
- `[service.py:ChatConverterService._copy_chat_assets]` `_copy_chat_assets(self, source: Path, destination: Path) -> None` — copies top-level chat files and media subdirectories into a distribution folder.
- `[service.py:ChatConverterService._create_launcher]` `_create_launcher(self, target_dir: Path, folder_name: str, output_filename: str, contact_name: Optional[str] = None, create_index: bool = False) -> List[Path]` — generates outer redirect HTML launcher file(s).
- `[service.py:ChatConverterService._find_chat_file]` `_find_chat_file(self, folder: Path) -> Path` — locates the exported `.txt` transcript inside `folder`.
- `[service.py:ChatConverterService._detect_date_order]` `_detect_date_order(self, messages: List[ChatMessage]) -> DateOrder` — infers `DateOrder.MONTH_FIRST` vs `DateOrder.DAY_FIRST` from `msg.raw_date`.
- `[service.py:ChatConverterService._resolve_participants]` `_resolve_participants(self, folder: Path, senders: Dict[str, int], explicit_you: Optional[str], chat_file: Optional[Path] = None, raw_messages: Optional[List[ChatMessage]] = None) -> tuple` — returns `(you_name, contact_name)`.
- `[service.py:ChatConverterService._load_assets]` `_load_assets(self, base_dir: Path) -> tuple` — reads and returns `(template, css, js, lottie)` strings.
- Subdirectories:
  - [`./domain/README.md`](./domain/README.md) — Core domain enums (`MessageType`, `MediaType`, `Direction`, `DateOrder`), frozen value dataclasses (`Attachment`, `ChatMessage`), and `ChatSession` aggregate.
  - [`./parsers/README.md`](./parsers/README.md) — `IChatParser` strategy contract, concrete `IOSChatParser` and `AndroidChatParser` implementations, and `ParserFactory`.
  - [`./pipeline/README.md`](./pipeline/README.md) — Message enrichment pipeline (`MediaResolver` for attachment resolution, voice caching, and sticker prep; `RichLinkExtractor` for URL extraction and anchor formatting).
  - [`./renderers/README.md`](./renderers/README.md) — HTML presentation layer (`ChatHtmlBuilder`, `VoiceNoteComponent`, `RichLinkComponent`, `MediaCardComponent`).

## Invariants
- `[__init__.py:__all__]` Package star-imports are restricted to the 18 symbols re-exported from `.service`, `.domain`, `.parsers`, `.pipeline`, and `.renderers`.
- `[service.py:ChatConverterService.convert]` Requires `folder_path` to exist on disk (`FileNotFoundError` otherwise); when `dist_dir` is truthy, copies source contents to `dist_dir / source_folder.name` before locating the chat file and resolving media so downstream reads and writes target `active_folder` (while `_resolve_participants` still receives `source_folder`).
- `[service.py:ChatConverterService.convert]` Tallies `sender_counts` (`senders`) only for messages where `msg.sender` is truthy and `msg.type == MessageType.MESSAGE`, and assigns `Direction.SENT` strictly on exact equality `msg.sender == resolved_you` (otherwise `Direction.RECEIVED`).
- `[service.py:ChatConverterService.convert]` Defaults `assets_dir` to `Path(__file__).parent.parent` when `assets_dir` is `None`, and produces a `.zip` archive only when both `create_zip` and `dist_dir` are truthy (`if create_zip and dist_path:`).
- `[service.py:ChatConverterService._find_chat_file]` Assumes the transcript is a direct `*.txt` child of `folder` (`FileNotFoundError` if none), prioritizing exact `_chat.txt` (case-insensitive), then filenames containing `'chat'` or `'whatsapp'`, then `txt_files[0]`.
- `[service.py:ChatConverterService._detect_date_order]` Strips Unicode bidi/BOM characters (`[\u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff]`), splits on `/`, `.`, or `-`, and returns `DateOrder.MONTH_FIRST` only when at least one 3-part integer date has `p2 > 12` and none has `p1 > 12`; all ambiguous or day-over-12 cases default to `DateOrder.DAY_FIRST`.
- `[service.py:ChatConverterService._resolve_participants]` Enforces 5-tier participant resolution precedence: (1) `explicit_you`; (2) sender substring match in `[folder.name, chat_file.stem, chat_file.name]` when `len(senders) == 2`; (3) self-action prefix match (`"You turned "`, `"You deleted "`, `"You changed "`, `"أنت حذفت"`, `"قمت ب"`) on `msg.text` for a sender in `senders` when `len(senders) == 2`; (4) `min(senders, key=senders.get)` fallback; (5) `(None, "WhatsApp Chat")` when `senders` is empty. Contact defaults to `"WhatsApp Chat"` if no distinct second sender exists.
- `[service.py:ChatConverterService._copy_chat_assets]` No-ops when `source.resolve() == destination.resolve()`; skips top-level entries named `.ds_store`, `__pycache__`, or `thumbs.db` (case-insensitive), skips re-copying top-level files whose destination size matches `item.stat().st_size` (while still repairing `.webp` loops), and ignores `.DS_Store` and `__pycache__` in subdirectories via `shutil.ignore_patterns`.
- `[service.py:ChatConverterService._load_assets]` Requires `template.html`, `style.css`, and `script.js` directly in `base_dir`, while `lottie.min.js` is optional (checked at `base_dir / 'lottie.min.js'`, then `base_dir / 'assets' / 'lottie.min.js'`, defaulting to `""`).

## Side Effects
- `[__init__.py]` None (pure import/re-export module).
- `[service.py:ChatConverterService.convert]` Raises `FileNotFoundError` if `folder_path` does not exist; creates `dist_path` and `active_folder` directories when `dist_dir` is set; delegates parsing, `MediaResolver` asset preparation, and `ChatHtmlBuilder.build` rendering; writes UTF-8 HTML to `active_folder / output_filename`; optionally writes outer launcher HTML file(s) in `dist_path` or `active_folder.parent` while catching and suppressing any `Exception`; optionally writes `<dist_path>.zip` via `shutil.make_archive`.
- `[service.py:ChatConverterService._copy_chat_assets]` Creates `destination` directory (`mkdir`), copies top-level files via `shutil.copy2` and subdirectories recursively via `shutil.copytree(..., dirs_exist_ok=True)`, and mutates top-level `.webp` files in place via `MediaResolver._ensure_webp_infinite_loop(dest_file)`.
- `[service.py:ChatConverterService._create_launcher]` Builds RTL Arabic/English redirect HTML using URL-encoded `quote(f"{folder_name}/{output_filename}")` and `json.dumps(relative_target)`, writing UTF-8 `"افتح المحادثة هنا - Open Chat Here.html"` (and `"index.html"` when `create_index=True`) in `target_dir`.
- `[service.py:ChatConverterService._find_chat_file]` Scans `folder` via `folder.glob('*.txt')` and raises `FileNotFoundError` if empty.
- `[service.py:ChatConverterService._load_assets]` Reads UTF-8 text files (`template.html`, `style.css`, `script.js`, and optionally `lottie.min.js` or `assets/lottie.min.js`) from disk; raises `FileNotFoundError`/I/O errors if required assets are missing.

## Verification
- Run: `python3 -m unittest discover tests`
