"""
Media Pipeline and Asset Resolution Engine.
Resolves, classifies, and prepares media attachments for presentation.
"""

import re
import os
import struct
import base64
from pathlib import Path
from typing import Tuple, Optional
from urllib.parse import quote
from ..domain.models import Attachment
from ..domain.enums import MediaType


class MediaResolver:
    """Resolves attachment references within message text against local storage."""

    BIDI_CHARS = '\u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff\xa0'

    IOS_ATTACH_PATTERN = re.compile(r'<[^:>]+:\s*([^>]+)>')
    ANDROID_ATTACH_PATTERN = re.compile(r'(.+?)\s*\((?:file attached|ملف مرفق)\)', re.IGNORECASE)

    OMITTED_PHRASES = [
        '<Media omitted>',
        '<ملف وسائط تم حذفه>',
        'لم يتم إدراج الصورة',
        'لم يتم إدراج الفيديوهات',
        'لم يتم إدراج ملف صوتي',
        'لم يتم إدراج المستند',
        'لم يتم إدراج الملصق',
        '<ملصق تم استبعاده>',
        'sticker omitted',
        '<sticker omitted>',
        'Sticker omitted',
        '<تم استبعاد الوسائط>'
    ]

    IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.heic'}
    VIDEO_EXTS = {'.mp4', '.mov', '.avi', '.mkv', '.3gp', '.webm'}
    AUDIO_EXTS = {'.opus', '.mp3', '.ogg', '.m4a', '.wav', '.aac', '.caf'}
    PDF_EXTS = {'.pdf'}
    DOC_EXTS = {'.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.txt', '.csv', '.zip'}
    STICKER_EXTS = {'.was', '.webp'}

    EDITED_PATTERN = re.compile(
        r'\s*<(?:\s*(?:This message was edited|تم تعديل هذه الرسالة|Ce message a été modifié|Diese Nachricht wurde bearbeitet|Questo messaggio è stato modificato|Este mensaje fue editado|Esta mensagem foi editada)\s*)>\s*$',
        re.IGNORECASE
    )

    def __init__(self, media_folder: Path, embed_images: bool = False):
        self.media_folder = media_folder
        self.embed_images = embed_images

    def resolve(self, text: str) -> Tuple[Optional[Attachment], str]:
        """
        Inspect message text for media references.
        Returns a tuple of (Attachment or None, clean_text_without_attachment_tag).
        """
        clean_text = text

        # Check for omitted media markers
        for phrase in self.OMITTED_PHRASES:
            if phrase in clean_text:
                clean_text = clean_text.replace(phrase, '').strip(f' {self.BIDI_CHARS}')
                attachment = Attachment(
                    filename=phrase,
                    media_type=MediaType.OMITTED,
                    is_omitted=True
                )
                return attachment, clean_text

        # 1. Match iOS format: <tag: filename>
        ios_match = self.IOS_ATTACH_PATTERN.search(clean_text)
        candidate_filename: Optional[str] = None

        if ios_match:
            candidate = ios_match.group(1).strip(f' {self.BIDI_CHARS}')
            target_path = self.media_folder / candidate
            if target_path.exists():
                candidate_filename = candidate
                clean_text = self.IOS_ATTACH_PATTERN.sub('', clean_text).strip(f' {self.BIDI_CHARS}')

        # 2. Match Android format: filename (file attached)
        if not candidate_filename:
            android_match = self.ANDROID_ATTACH_PATTERN.search(clean_text)
            if android_match:
                candidate = android_match.group(1).strip(f' {self.BIDI_CHARS}')
                target_path = self.media_folder / candidate
                if target_path.exists():
                    candidate_filename = candidate
                    clean_text = self.ANDROID_ATTACH_PATTERN.sub('', clean_text).strip(f' {self.BIDI_CHARS}')

        if not candidate_filename:
            if self.EDITED_PATTERN.search(clean_text):
                clean_text = self.EDITED_PATTERN.sub('', clean_text).strip(f' {self.BIDI_CHARS}')
            return None, clean_text

        if self.EDITED_PATTERN.search(clean_text):
            clean_text = self.EDITED_PATTERN.sub('', clean_text).strip(f' {self.BIDI_CHARS}')

        target_path = self.media_folder / candidate_filename
        ext = target_path.suffix.lower()
        upper_filename = candidate_filename.upper()
        is_sticker = (
            ext in self.STICKER_EXTS
            or upper_filename.startswith('STK-')
            or '-STICKER-' in upper_filename
        )

        extra_data = None
        if is_sticker:
            media_type = MediaType.STICKER
            if ext == '.was':
                extra_data = self._extract_was_lottie(target_path)
            elif ext == '.webp':
                is_anim = self._ensure_webp_infinite_loop(target_path)
                if is_anim:
                    extra_data = 'animated_webp'
        else:
            media_type = self._classify_extension(ext)
            if media_type == MediaType.AUDIO:
                extra_data = self._prepare_audio_asset(target_path, candidate_filename)

        file_size = target_path.stat().st_size if target_path.exists() else 0
        mime_type = self._resolve_mime_type(ext)

        attachment = Attachment(
            filename=candidate_filename,
            filepath=target_path,
            media_type=media_type,
            file_size_bytes=file_size,
            mime_type=mime_type,
            extra_data=extra_data
        )

        return attachment, clean_text

    def _prepare_audio_asset(self, path: Path, filename: str) -> Optional[str]:
        """Extracts exact Ogg/Opus duration and writes a CORS-free JS binary cache module for instant file:// WebAudio playback."""
        if not path.exists():
            return None
        duration_str = None
        try:
            data = path.read_bytes()
            idx = data.rfind(b"OggS")
            if idx != -1 and len(data) >= idx + 14:
                granule = struct.unpack_from("<q", data, idx + 6)[0]
                if granule > 0:
                    duration_str = f"{granule / 48000.0:.2f}"

            cache_dir = self.media_folder / "_voice_cache"
            cache_dir.mkdir(parents=True, exist_ok=True)
            cache_file = cache_dir / f"{filename}.js"
            if not cache_file.exists() or cache_file.stat().st_size == 0:
                b64 = base64.b64encode(data).decode("ascii")
                encoded_key = quote(filename)
                js_payload = (
                    "window.__WA_VOICE_CACHE__=window.__WA_VOICE_CACHE__||{};"
                    f'window.__WA_VOICE_CACHE__["{encoded_key}"]="{b64}";\n'
                )
                cache_file.write_text(js_payload, encoding="utf-8")
        except Exception:
            pass
        return duration_str

    def _extract_was_lottie(self, path: Path) -> Optional[str]:
        """Extracts Lottie JSON animation from a WhatsApp .was sticker zip archive."""
        if not path.exists():
            return None
        try:
            import zipfile
            with zipfile.ZipFile(path, 'r') as z:
                if 'animation/animation.json' in z.namelist():
                    return z.read('animation/animation.json').decode('utf-8', errors='ignore')
        except Exception:
            pass
        return None

    @staticmethod
    def _ensure_webp_infinite_loop(path: Path) -> bool:
        """Ensures animated WebP stickers loop infinitely (loop_count=0) and returns True if animated."""
        if not path.exists() or path.suffix.lower() != '.webp':
            return False
        try:
            with open(path, 'rb') as f:
                data = bytearray(f.read())
            is_anim = False
            if len(data) > 20 and data[12:16] == b'VP8X' and (data[20] & 0x02):
                is_anim = True
            anim_idx = data.find(b'ANIM')
            if anim_idx != -1:
                is_anim = True
                if len(data) >= anim_idx + 14:
                    loop = int.from_bytes(data[anim_idx+12:anim_idx+14], 'little')
                    if loop != 0:
                        data[anim_idx+12:anim_idx+14] = b'\x00\x00'
                        with open(path, 'wb') as f:
                            f.write(data)
            return is_anim
        except Exception:
            return False

    def get_base64_data_uri(self, attachment: Attachment) -> str:
        """Embed local image file as Base64 URI if configured and valid."""
        if not attachment.filepath or not attachment.filepath.exists():
            return ""
        try:
            with open(attachment.filepath, 'rb') as f:
                b64 = base64.b64encode(f.read()).decode('ascii')
            return f"data:{attachment.mime_type};base64,{b64}"
        except OSError:
            return ""

    def _classify_extension(self, ext: str) -> MediaType:
        if ext in self.IMAGE_EXTS:
            return MediaType.IMAGE
        if ext in self.VIDEO_EXTS:
            return MediaType.VIDEO
        if ext in self.AUDIO_EXTS:
            return MediaType.AUDIO
        if ext in self.PDF_EXTS:
            return MediaType.PDF
        if ext in self.DOC_EXTS:
            return MediaType.DOCUMENT
        return MediaType.FILE

    def _resolve_mime_type(self, ext: str) -> str:
        mime_map = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.webm': 'video/webm',
            '.opus': 'audio/ogg; codecs=opus',
            '.ogg': 'audio/ogg',
            '.mp3': 'audio/mpeg',
            '.m4a': 'audio/mp4',
            '.pdf': 'application/pdf',
            '.was': 'application/json',
        }
        return mime_map.get(ext, 'application/octet-stream')
