"""
Component Renderers for WhatsApp Archival Presentation.
Follows Component pattern and Apple Human Interface Guidelines.
"""

from html import escape
from urllib.parse import quote
from ..domain.models import Attachment, ChatMessage
from ..domain.enums import MediaType
from ..pipeline.link import RichLinkExtractor


class VoiceNoteComponent:
    """Renders Apple-grade interactive Voice Message Component."""

    @staticmethod
    def render(attachment: Attachment) -> str:
        filename = attachment.filename
        encoded_filename = quote(filename)

        duration_attr = ""
        duration_label = "--:--"
        if attachment.extra_data:
            try:
                sec = float(attachment.extra_data)
                if sec > 0:
                    duration_attr = f' data-duration="{sec:.2f}"'
                    mins = int(sec // 60)
                    rem_secs = int(sec % 60)
                    duration_label = f"{mins}:{rem_secs:02d}"
            except ValueError:
                pass

        # 36 precomputed bar heights for static CSS/SVG fallback before JS canvas hydrates
        return f'''<div class="apple-voice-player" data-src="{encoded_filename}"{duration_attr} data-title="{escape(filename)}">
            <button class="voice-play-btn" type="button" aria-label="Play Voice Message">
                <svg class="play-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                </svg>
                <svg class="pause-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="display:none;">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
            </button>
            <div class="waveform-container">
                <canvas class="waveform-canvas" width="220" height="34" aria-label="Audio Waveform"></canvas>
            </div>
            <div class="voice-meta">
                <span class="voice-duration" title="Click to toggle remaining time">{duration_label}</span>
                <button class="speed-pill-btn" type="button" title="Playback speed">1.0×</button>
            </div>
            <audio preload="none" style="display:none;"></audio>
        </div>'''


class RichLinkComponent:
    """Renders Apple News / Safari Reading List style rich link cards."""

    @staticmethod
    def render(link_data: dict) -> str:
        raw_url = link_data['raw_url']
        escaped_url = escape(raw_url)
        domain = escape(link_data['domain'])
        title = escape(link_data['title'])
        icon = link_data['icon']
        sec_badge = '<span class="sec-badge" title="Secure HTTPS connection">🔒</span>' if link_data['is_secure'] else ''

        return f'''<div class="rich-link-card">
            <a href="{escaped_url}" target="_blank" rel="noopener noreferrer" class="link-card-inner">
                <div class="link-card-icon">{icon}</div>
                <div class="link-card-content">
                    <div class="link-card-header">
                        <span class="link-card-domain">{domain}</span>
                        {sec_badge}
                    </div>
                    <div class="link-card-title">{title}</div>
                    <div class="link-card-url">{escaped_url}</div>
                </div>
                <div class="link-card-action">↗</div>
            </a>
        </div>'''


class MediaCardComponent:
    """Renders images, videos, documents, and omitted media markers."""

    _sticker_counter = 0

    @staticmethod
    def render_image(attachment: Attachment, base64_uri: str = "") -> str:
        filename = attachment.filename
        src = base64_uri if base64_uri else quote(filename)
        return f'''<div class="media-container image-container">
            <img src="{src}" alt="{escape(filename)}" onclick="openMedia(this.src, 'image')" loading="lazy">
        </div>'''

    @classmethod
    def render_sticker(cls, attachment: Attachment, base64_uri: str = "") -> str:
        filename = attachment.filename
        cls._sticker_counter += 1
        safe_id = f"stk_{cls._sticker_counter}_{abs(hash(filename)) % 100000:05d}"

        if attachment.extra_data:
            escaped_json = attachment.extra_data.replace('</', r'<\/')
            return f'''<div class="media-container sticker-container" onclick="replaySticker(this)" role="button" tabindex="0" title="Tap to replay sticker animation" aria-label="Animated Sticker">
                <div class="lottie-sticker" id="{safe_id}"></div>
                <script type="application/json" id="data_{safe_id}">{escaped_json}</script>
            </div>'''

        src = base64_uri if base64_uri else quote(filename)
        return f'''<div class="media-container sticker-container" onclick="replaySticker(this)" role="button" tabindex="0" title="Tap to replay sticker animation" aria-label="Sticker">
            <img class="static-sticker" src="{src}" alt="{escape(filename)}" loading="lazy">
        </div>'''

    @staticmethod
    def render_video(attachment: Attachment) -> str:
        encoded_filename = quote(attachment.filename)
        return f'''<div class="media-container video-container">
            <div class="video-thumbnail" onclick="openMedia('{encoded_filename}', 'video')">
                <video src="{encoded_filename}" preload="metadata"></video>
            </div>
        </div>'''

    @staticmethod
    def render_document(attachment: Attachment) -> str:
        filename = attachment.filename
        encoded_filename = quote(filename)
        ext = attachment.filepath.suffix.lower().replace('.', '') if attachment.filepath else 'file'
        icon_class = 'pdf' if ext == 'pdf' else 'doc' if ext in ['doc', 'docx'] else 'xls' if ext in ['xls', 'xlsx'] else 'ppt' if ext in ['ppt', 'pptx'] else 'file'
        size_str = attachment.human_readable_size

        return f'''<a href="{encoded_filename}" target="_blank" class="document-link">
            <div class="document-icon {icon_class}">{ext.upper()[:4]}</div>
            <div class="document-info">
                <div class="document-name" dir="auto">{escape(filename)}</div>
                <div class="document-size">{size_str}</div>
            </div>
            <div class="document-download-icon">↓</div>
        </a>'''

    @staticmethod
    def render_omitted(attachment: Attachment) -> str:
        return f'''<div class="media-omitted">
            <span>📎 {escape(attachment.filename)}</span>
        </div>'''
