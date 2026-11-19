"""
HTML Document Builder (Builder Pattern).
Assembles domain entities and rendered components into a cohesive,
self-contained Apple-standard conversational HTML document.
"""

from html import escape
from datetime import datetime
import re
from ..domain.models import ChatSession, ChatMessage
from ..domain.enums import MessageType, MediaType, Direction, DateOrder
from ..pipeline.media import MediaResolver
from ..pipeline.link import RichLinkExtractor
from .components import VoiceNoteComponent, RichLinkComponent, MediaCardComponent


class ChatHtmlBuilder:
    """Constructs self-contained Cupertino HTML documents."""

    def __init__(self, media_resolver: MediaResolver):
        self.media_resolver = media_resolver

    def build(self, session: ChatSession, template_html: str, css_content: str, js_content: str, lottie_content: str = "") -> str:
        """Render complete HTML page with inlined or embedded assets."""
        html_elements = []
        current_date = None

        for msg in session.messages:
            # 1. Date Separator Header
            if msg.raw_date != current_date:
                current_date = msg.raw_date
                formatted_date = self._format_date(msg.raw_date, session.date_order)
                html_elements.append(f'''<div class="date-separator">
                    <span>{formatted_date}</span>
                </div>''')

            # 2. System Messages & Call Logs
            if msg.type == MessageType.SYSTEM:
                html_elements.append(f'''<div class="system-message">
                    <span dir="auto">{escape(msg.text)}</span>
                </div>''')
                continue

            # 3. Conversational Message
            is_sent = msg.direction == Direction.SENT
            direction_class = "sent" if is_sent else "received"
            bubble_parts = []

            # Sender title for received messages
            if not is_sent and msg.sender:
                bubble_parts.append(f'<div class="sender-name" dir="auto">{escape(msg.sender)}</div>')

            # Render Attachment if present
            if msg.attachment:
                att = msg.attachment
                if att.media_type == MediaType.AUDIO:
                    bubble_parts.append(VoiceNoteComponent.render(att))
                elif att.media_type == MediaType.IMAGE:
                    b64 = self.media_resolver.get_base64_data_uri(att) if self.media_resolver.embed_images else ""
                    bubble_parts.append(MediaCardComponent.render_image(att, b64))
                elif att.media_type == MediaType.STICKER:
                    b64 = self.media_resolver.get_base64_data_uri(att) if self.media_resolver.embed_images else ""
                    bubble_parts.append(MediaCardComponent.render_sticker(att, b64))
                elif att.media_type == MediaType.VIDEO:
                    bubble_parts.append(MediaCardComponent.render_video(att))
                elif att.media_type in [MediaType.PDF, MediaType.DOCUMENT, MediaType.FILE]:
                    bubble_parts.append(MediaCardComponent.render_document(att))
                elif att.media_type == MediaType.OMITTED:
                    bubble_parts.append(MediaCardComponent.render_omitted(att))

            # Render Rich Link Cards if URLs exist in message
            if msg.text:
                link_cards = RichLinkExtractor.extract_urls(msg.text)
                for card in link_cards:
                    bubble_parts.append(RichLinkComponent.render(card))

            # Render Message Body Text
            if msg.text:
                if msg.is_deleted:
                    bubble_parts.append(f'<div class="message-text deleted-message" dir="auto">🚫 {escape(msg.text)}</div>')
                elif msg.is_call:
                    icon = '📹' if any(k in msg.text for k in ['فيديو', 'video', 'Video']) else '📞'
                    bubble_parts.append(f'<div class="message-text call-message" dir="auto">{icon} {escape(msg.text)}</div>')
                else:
                    formatted_text = RichLinkExtractor.format_inline_links(msg.text)
                    formatted_text = formatted_text.replace('\n', '<br>')
                    bubble_parts.append(f'<div class="message-text" dir="auto">{formatted_text}</div>')

            # Render Formatted Time & Metadata
            formatted_time = self._format_time(msg.raw_time)
            time_parts = []
            if msg.is_edited:
                is_ar = any('\u0600' <= char <= '\u06FF' for char in (msg.text or ""))
                edited_label = "معدلة" if is_ar else "Edited"
                time_parts.append(
                    f'<span class="message-edited" title="This message was edited / تم تعديل هذه الرسالة">'
                    f'<svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" aria-hidden="true">'
                    f'<path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/>'
                    f'</svg> {edited_label}</span>'
                )
            time_parts.append(f'<span class="time-text">{formatted_time}</span>')
            bubble_parts.append(f'<div class="message-time">{"".join(time_parts)}</div>')

            is_sticker_only = (
                msg.attachment is not None and
                msg.attachment.media_type == MediaType.STICKER and
                not (msg.text and msg.text.strip())
            )
            sticker_bubble_class = " sticker-bubble" if is_sticker_only else ""

            html_elements.append(f'''<div class="message {direction_class}">
                <div class="message-bubble{sticker_bubble_class}">
                    {''.join(bubble_parts)}
                </div>
            </div>''')

        chat_name = session.contact_name or "WhatsApp Chat"
        rendered_html = template_html.format(
            title=f"Chat with {chat_name}",
            chat_name=chat_name,
            message_count=session.message_count,
            messages='\n'.join(html_elements)
        )

        combined_js = f"{lottie_content}\n\n{js_content}" if lottie_content else js_content

        final_html = rendered_html.replace(
            '<link rel="stylesheet" href="style.css">',
            f'<style>\n{css_content}\n    </style>'
        ).replace(
            '<script src="script.js"></script>',
            f'<script>\n{combined_js}\n    </script>'
        )

        return final_html

    def _format_date(self, date_str: str, date_order: DateOrder) -> str:
        clean = re.sub(r'[\u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff]', '', date_str).strip()
        norm = re.sub(r'[/.-]', '/', clean)
        parts = norm.split('/')
        if len(parts) == 3:
            y_fmt = '%Y' if len(parts[2]) == 4 else '%y'
            formats = [f'%m/%d/{y_fmt}', f'%d/%m/{y_fmt}'] if date_order == DateOrder.MONTH_FIRST else [f'%d/%m/{y_fmt}', f'%m/%d/{y_fmt}']
            for fmt in formats:
                try:
                    dt = datetime.strptime(norm, fmt)
                    return dt.strftime('%B %d, %Y')
                except ValueError:
                    pass
        return date_str

    def _format_time(self, time_str: str) -> str:
        clean = time_str.replace('\xa0', ' ').strip(' \u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff')
        m = re.match(r'^(\d{1,2}:\d{2}):\d{2}(\s*.*)$', clean)
        if m:
            return f"{m.group(1)}{m.group(2)}"
        return clean
