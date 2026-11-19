# converter/pipeline

## Overview
The `converter.pipeline` package implements message-content enrichment for media attachments and hyperlinks, re-exporting `MediaResolver` and `RichLinkExtractor`. `MediaResolver` resolves platform-specific attachment and omitted markers against local media storage while preparing audio caches and sticker assets, whereas `RichLinkExtractor` extracts URL metadata and formats HTML-escaped inline anchor links.

## Interface
- `[__init__.py:__all__]` Re-exports `MediaResolver` (from `.media`) and `RichLinkExtractor` (from `.link`) via `__all__ = ["MediaResolver", "RichLinkExtractor"]`.
- `[link.py:RichLinkExtractor]` Defines `URL_PATTERN` (compiled HTTP/HTTPS regex) and `CATEGORY_ICONS` (`dict` mapping `'video'`, `'code'`, `'social'`, `'news'`, `'portal'`, `'secure'` to emoji strings).
- `[link.py:RichLinkExtractor.extract_urls]` `@classmethod extract_urls(cls, text: str) -> List[Dict[str, str]]` — extracts HTTP/HTTPS URLs from `text` and returns metadata dicts with keys `'raw_url'`, `'domain'`, `'title'`, `'category'`, `'icon'`, and `'is_secure'`.
- `[link.py:RichLinkExtractor.format_inline_links]` `@classmethod format_inline_links(cls, text: str) -> str` — HTML-escapes `text` and wraps matched URLs in `<a href="..." target="_blank" rel="noopener noreferrer" class="chat-link">...</a>`.
- `[link.py:RichLinkExtractor._categorize_domain]` `@classmethod _categorize_domain(cls, domain: str) -> str` — classifies `domain` into `'video'`, `'code'`, `'social'`, `'news'`, or `'portal'`.
- `[media.py:MediaResolver]` Defines `BIDI_CHARS`, `IOS_ATTACH_PATTERN`, `ANDROID_ATTACH_PATTERN`, `OMITTED_PHRASES` (12 English/Arabic strings), `IMAGE_EXTS`, `VIDEO_EXTS`, `AUDIO_EXTS`, `PDF_EXTS`, `DOC_EXTS`, `STICKER_EXTS`, and `EDITED_PATTERN`.
- `[media.py:MediaResolver.__init__]` `__init__(self, media_folder: Path, embed_images: bool = False)` — initializes `self.media_folder` and `self.embed_images`.
- `[media.py:MediaResolver.resolve]` `resolve(self, text: str) -> Tuple[Optional[Attachment], str]` — detects omitted markers, iOS `<tag: filename>`, or Android `filename (file attached|ملف مرفق)` tags, cleans edited/bidi markers, prepares audio/sticker assets, and returns `(Attachment | None, clean_text)`.
- `[media.py:MediaResolver.get_base64_data_uri]` `get_base64_data_uri(self, attachment: Attachment) -> str` — returns `data:{attachment.mime_type};base64,{b64}` for `attachment.filepath`, or `""` when missing or on `OSError`.
- `[media.py:MediaResolver._prepare_audio_asset]` `_prepare_audio_asset(self, path: Path, filename: str) -> Optional[str]` — computes an Ogg/Opus duration string and writes `{media_folder}/_voice_cache/{filename}.js`.
- `[media.py:MediaResolver._extract_was_lottie]` `_extract_was_lottie(self, path: Path) -> Optional[str]` — extracts `'animation/animation.json'` from a `.was` ZIP archive.
- `[media.py:MediaResolver._ensure_webp_infinite_loop]` `@staticmethod _ensure_webp_infinite_loop(path: Path) -> bool` — detects animated WebP stickers and rewrites non-zero `ANIM` loop counts to `0`.
- `[media.py:MediaResolver._classify_extension]` `_classify_extension(self, ext: str) -> MediaType` — maps file extension to `MediaType.IMAGE`, `VIDEO`, `AUDIO`, `PDF`, `DOCUMENT`, or fallback `FILE`.
- `[media.py:MediaResolver._resolve_mime_type]` `_resolve_mime_type(self, ext: str) -> str` — maps 14 extensions to MIME strings, falling back to `'application/octet-stream'`.

## Invariants
- `[link.py:RichLinkExtractor.URL_PATTERN]` Matches only `http://` or `https://` URLs excluding whitespace and `<>"{}|\^`[]`.
- `[link.py:RichLinkExtractor.extract_urls]` Lowercases `parsed.netloc`, strips leading `'www.'`, truncates the first path segment in `title` to 24 characters (`parts[0][:24]`), and emits `'is_secure'` as a `bool` (`parsed.scheme == 'https'`) despite the `List[Dict[str, str]]` return annotation.
- `[link.py:RichLinkExtractor._categorize_domain]` Checks domain substrings in priority order (`video` -> `code` -> `social` -> `news` -> `portal`); the `'secure'` key in `CATEGORY_ICONS` is never returned.
- `[link.py:RichLinkExtractor.format_inline_links]` Calls `html.escape(text)` before `cls.URL_PATTERN.sub(...)`, and calls `html.escape(url)` again inside `_replace`.
- `[media.py:MediaResolver.__init__]` Stores `self.embed_images`, which is not referenced elsewhere in `MediaResolver`.
- `[media.py:MediaResolver.resolve]` Checks `OMITTED_PHRASES` first via substring match and immediately returns `(Attachment(..., media_type=MediaType.OMITTED, is_omitted=True), clean_text)` without stripping `EDITED_PATTERN` or probing disk.
- `[media.py:MediaResolver.resolve]` Accepts iOS or Android attachment matches only when `(self.media_folder / candidate).exists()` is `True`, evaluating `IOS_ATTACH_PATTERN` before `ANDROID_ATTACH_PATTERN`, and strips `EDITED_PATTERN` and `BIDI_CHARS` on non-omitted paths.
- `[media.py:MediaResolver.resolve]` Classifies an attachment as `MediaType.STICKER` whenever `ext in {'.was', '.webp'}`, `upper_filename.startswith('STK-')`, or `'-STICKER-' in upper_filename`.
- `[media.py:MediaResolver._prepare_audio_asset]` Assumes a 48000 Hz sample clock (`granule / 48000.0`) reading `<q` at offset `idx + 6` from the final `b"OggS"` marker, assumes `filename` is valid for `_voice_cache/{filename}.js`, and suppresses all exceptions (`except Exception: pass`).
- `[media.py:MediaResolver._extract_was_lottie]` Assumes `.was` files are ZIP archives containing `'animation/animation.json'`, decodes UTF-8 with `errors='ignore'`, and suppresses all exceptions returning `None`.
- `[media.py:MediaResolver._ensure_webp_infinite_loop]` Assumes animated WebP files carry `VP8X` bit `0x02` at byte 20 and/or an `ANIM` chunk with a 2-byte little-endian loop count at `anim_idx + 12 : anim_idx + 14`; returns `False` on any exception.
- `[media.py:MediaResolver._resolve_mime_type]` Explicitly maps only 14 extensions (`.was` -> `'application/json'`, `.opus` -> `'audio/ogg; codecs=opus'`, etc.); other recognized extensions in `IMAGE_EXTS`, `VIDEO_EXTS`, `AUDIO_EXTS`, and all `DOC_EXTS` fall back to `'application/octet-stream'`.

## Side Effects
- `[link.py:RichLinkExtractor]` None (pure string, URL, and HTML transformation).
- `[media.py:MediaResolver.resolve]` Reads filesystem existence and `stat().st_size` metadata under `self.media_folder` and triggers `_prepare_audio_asset`, `_extract_was_lottie`, or `_ensure_webp_infinite_loop`.
- `[media.py:MediaResolver._prepare_audio_asset]` Reads audio file bytes from disk, creates `{self.media_folder}/_voice_cache` via `mkdir(parents=True, exist_ok=True)`, base64-encodes the audio payload, and writes `{cache_dir}/{filename}.js` defining `window.__WA_VOICE_CACHE__` if missing or empty.
- `[media.py:MediaResolver._extract_was_lottie]` Reads `'animation/animation.json'` from `.was` ZIP archives on disk.
- `[media.py:MediaResolver._ensure_webp_infinite_loop]` Reads `.webp` bytes from disk and mutates `.webp` files in place (`open(path, 'wb')`) by writing `b'\x00\x00'` to `data[anim_idx+12:anim_idx+14]` when an `ANIM` chunk has `loop != 0`.
- `[media.py:MediaResolver.get_base64_data_uri]` Reads `attachment.filepath` bytes from disk and base64-encodes them into a `data:` URI string.

## Verification
- Run: `python3 -m unittest discover tests`
