# converter/renderers

## Overview
The `converter.renderers` package implements the HTML presentation layer, transforming `ChatSession` and `ChatMessage` domain models into a self-contained HTML document via `ChatHtmlBuilder` and modular attachment/link renderers (`VoiceNoteComponent`, `RichLinkComponent`, `MediaCardComponent`). It delegates optional base64 asset embedding to `MediaResolver` and URL extraction/link formatting to `RichLinkExtractor`, performing no direct disk I/O itself.

## Interface
- `[__init__.py:__all__]` Re-exports `VoiceNoteComponent`, `RichLinkComponent`, `MediaCardComponent`, and `ChatHtmlBuilder` (`__all__ = ['VoiceNoteComponent', 'RichLinkComponent', 'MediaCardComponent', 'ChatHtmlBuilder']`).
- `[builder.py:ChatHtmlBuilder]` Assembles `ChatSession` messages, media cards, rich link previews, templates, CSS, and JavaScript into a single HTML document string.
- `[builder.py:ChatHtmlBuilder.__init__]` `__init__(self, media_resolver: MediaResolver)` — stores `self.media_resolver`.
- `[builder.py:ChatHtmlBuilder.build]` `build(self, session: ChatSession, template_html: str, css_content: str, js_content: str, lottie_content: str = '') -> str` — renders date separators, system messages, conversational bubbles, attachments, rich link cards, message body text, and edited/time metadata, and inlines CSS/JS into `template_html`.
- `[builder.py:ChatHtmlBuilder._format_date]` `_format_date(self, date_str: str, date_order: DateOrder) -> str` — strips directional/BOM characters, normalizes separators to `'/'`, formats 3-part dates into `'%B %d, %Y'`, or falls back to `date_str`.
- `[builder.py:ChatHtmlBuilder._format_time]` `_format_time(self, time_str: str) -> str` — normalizes NBSP, strips directional/BOM characters, and drops seconds from `HH:MM:SS` timestamps.
- `[components.py:VoiceNoteComponent]` Static renderer for interactive audio voice-note players (`@staticmethod render(attachment: Attachment) -> str`), emitting `.apple-voice-player` markup with waveform canvas, speed toggle button, hidden `<audio>` element, and optional duration metadata.
- `[components.py:RichLinkComponent]` Static renderer for rich URL preview cards (`@staticmethod render(link_data: dict) -> str`), emitting `.rich-link-card` anchor markup from `raw_url`, `domain`, `title`, `icon`, and `is_secure`.
- `[components.py:MediaCardComponent]` Component renderer for images, stickers (Lottie JSON, animated WebP, static), videos, documents, and omitted media. Defines class counter `_sticker_counter = 0`, `@staticmethod render_image(attachment: Attachment, base64_uri: str = '') -> str`, `@classmethod render_sticker(cls, attachment: Attachment, base64_uri: str = '') -> str`, `@staticmethod render_video(attachment: Attachment) -> str`, `@staticmethod render_document(attachment: Attachment) -> str`, and `@staticmethod render_omitted(attachment: Attachment) -> str`.

## Invariants
- `[builder.py:ChatHtmlBuilder.build]` Assumes `template_html` supports `str.format` keys `{title}`, `{chat_name}`, `{message_count}`, and `{messages}`, and contains literal `'<link rel="stylesheet" href="style.css">'` and `'<script src="script.js"></script>'` markers for CSS/JS replacement.
- `[builder.py:ChatHtmlBuilder.build]` System messages (`msg.type == MessageType.SYSTEM`) short-circuit via `continue`, skipping sender headers, attachments, rich links, text formatting, and timestamps.
- `[builder.py:ChatHtmlBuilder.build]` Emits a date separator whenever `msg.raw_date != current_date` while iterating `session.messages` sequentially.
- `[builder.py:ChatHtmlBuilder.build]` Renders `.sender-name` only when `msg.direction != Direction.SENT` and `msg.sender` is truthy.
- `[builder.py:ChatHtmlBuilder.build]` Applies the `'sticker-bubble'` CSS class only when `msg.attachment` is present, `msg.attachment.media_type == MediaType.STICKER`, and `msg.text` is empty or whitespace-only.
- `[builder.py:ChatHtmlBuilder.build]` Invokes `self.media_resolver.get_base64_data_uri(att)` only for `MediaType.IMAGE` and `MediaType.STICKER` when `self.media_resolver.embed_images` is truthy; `VIDEO`, `AUDIO`, and `DOCUMENT` never receive embedded base64 data.
- `[builder.py:ChatHtmlBuilder.build]` Selects Arabic edited label `'معدلة'` when any character in `msg.text` is in `U+0600..U+06FF`, otherwise `'Edited'`; selects `'📹'` when `'فيديو'`, `'video'`, or `'Video'` appears in `msg.text`, otherwise `'📞'`.
- `[builder.py:ChatHtmlBuilder._format_date]` Assumes 3-part slash/dot/dash-separated dates place the year third (4 digits -> `'%Y'`, else `'%y'`) and prioritizes `'%m/%d/...'` when `date_order == DateOrder.MONTH_FIRST`, otherwise `'%d/%m/...'`.
- `[components.py:VoiceNoteComponent.render]` Requires `float(attachment.extra_data) > 0` (catching `ValueError`) before emitting `data-duration` and `MM:SS` formatting; defaults to `'--:--'` without `data-duration` otherwise.
- `[components.py:RichLinkComponent.render]` Expects `link_data` to contain keys `'raw_url'`, `'domain'`, `'title'`, `'icon'`, and `'is_secure'`.
- `[components.py:MediaCardComponent.render_sticker]` Treats `attachment.extra_data` starting with `'{'` as serialized Lottie JSON (ignoring `base64_uri`) and `'animated_webp'` as an animated WebP sticker.
- `[components.py:MediaCardComponent.render_document]` Falls back to extension `'file'` when `attachment.filepath` is falsy and truncates the icon badge label to 4 uppercase characters (`ext.upper()[:4]`).

## Side Effects
- `[builder.py:ChatHtmlBuilder.build]` Calls `self.media_resolver.get_base64_data_uri(att)` for `IMAGE`/`STICKER` when `embed_images` is truthy, and calls `RichLinkExtractor.extract_urls` and `RichLinkExtractor.format_inline_links`.
- `[builder.py:ChatHtmlBuilder.build]` Applies `html.escape` to system message text, `msg.sender`, deleted message text, and call message text (`session.contact_name`, `formatted_date`, and `formatted_time` are not passed through `html.escape`).
- `[components.py:VoiceNoteComponent.render]` Applies `urllib.parse.quote` to `attachment.filename` (`data-src`) and `html.escape` to `attachment.filename` (`data-title`).
- `[components.py:RichLinkComponent.render]` Applies `html.escape` to `link_data['raw_url']`, `link_data['domain']`, and `link_data['title']` (`link_data['icon']` is interpolated unescaped).
- `[components.py:MediaCardComponent.render_image]` Applies `urllib.parse.quote` to `attachment.filename` when `base64_uri` is empty, and `html.escape` to `attachment.filename` for `alt`.
- `[components.py:MediaCardComponent.render_sticker]` Mutates class attribute `MediaCardComponent._sticker_counter` (`+= 1`); escapes `'</'` to `'<\/'` inside inline Lottie JSON `<script>` tags, or applies `urllib.parse.quote` (when `base64_uri` is empty) and `html.escape` to `attachment.filename` for `<img>` elements.
- `[components.py:MediaCardComponent.render_video]` Applies `urllib.parse.quote` to `attachment.filename` in both the `onclick` handler and `<video>` `src`.
- `[components.py:MediaCardComponent.render_document]` Applies `urllib.parse.quote` to `attachment.filename` for `href` and `html.escape` to `attachment.filename` for `.document-name`.
- `[components.py:MediaCardComponent.render_omitted]` Applies `html.escape` to `attachment.filename`.

## Verification
- Run: `python3 -m unittest discover tests`
