# converter/domain

## Overview
The `converter.domain` package defines the core domain enumerations and data models for the WhatsApp Chat Archival Engine. It supplies enum classifications for message kinds, media categories, message directions, and date formats, along with frozen `Attachment` and `ChatMessage` value objects and the mutable `ChatSession` aggregate.

## Interface
- `[__init__.py:__all__]` Re-exports `MessageType`, `MediaType`, `Direction`, `DateOrder` (from `.enums`) and `Attachment`, `ChatMessage`, `ChatSession` (from `.models`).
- `[enums.py:MessageType]` `Enum` defining `MESSAGE = "message"`, `SYSTEM = "system"`, `CALL = "call"`.
- `[enums.py:MediaType]` `Enum` defining `NONE = "none"`, `IMAGE = "image"`, `VIDEO = "video"`, `AUDIO = "audio"`, `PDF = "pdf"`, `DOCUMENT = "document"`, `FILE = "file"`, `OMITTED = "omitted"`, `STICKER = "sticker"`.
- `[enums.py:Direction]` `Enum` defining `SENT = "sent"`, `RECEIVED = "received"`.
- `[enums.py:DateOrder]` `Enum` defining `DAY_FIRST = "day_first"`, `MONTH_FIRST = "month_first"`, `YEAR_FIRST = "year_first"`.
- `[models.py:Attachment]` `@dataclass(frozen=True)` representing an attachment with fields `filename: str`, `filepath: Optional[Path] = None`, `media_type: MediaType = MediaType.NONE`, `file_size_bytes: int = 0`, `mime_type: str = ""`, `is_omitted: bool = False`, `extra_data: Optional[str] = None`, and properties `human_readable_size -> str` and `exists_on_disk -> bool`.
- `[models.py:ChatMessage]` `@dataclass(frozen=True)` representing a parsed chat entry with fields `raw_date: str`, `raw_time: str`, `sender: Optional[str] = None`, `text: str = ""`, `type: MessageType = MessageType.MESSAGE`, `attachment: Optional[Attachment] = None`, `is_deleted: bool = False`, `is_call: bool = False`, `call_description: Optional[str] = None`, `is_edited: bool = False`, `formatted_date: str = ""`, `formatted_time: str = ""`, `direction: Direction = Direction.RECEIVED`.
- `[models.py:ChatSession]` `@dataclass` representing a chat session with fields `title: str`, `contact_name: str`, `you_name: Optional[str]`, `messages: List[ChatMessage] = field(default_factory=list)`, `date_order: DateOrder = DateOrder.DAY_FIRST`, `sender_counts: Dict[str, int] = field(default_factory=dict)`, and properties `message_count -> int` and `media_count -> int`.

## Invariants
- `[models.py:Attachment]` Frozen dataclass (`@dataclass(frozen=True)`), enforcing shallow immutability on fields after instantiation.
- `[models.py:Attachment.human_readable_size]` Returns `"0 KB"` when `file_size_bytes <= 0`, and formats positive byte counts scaled by `1024.0` across `B`, `KB`, `MB`, `GB`, falling back to `TB` with `:.1f` precision.
- `[models.py:ChatMessage]` Frozen dataclass (`@dataclass(frozen=True)`), enforcing shallow immutability on fields after instantiation.
- `[models.py:ChatSession]` Uses `field(default_factory=list)` for `messages` and `field(default_factory=dict)` for `sender_counts` to avoid shared mutable defaults; `ChatSession` itself remains mutable.
- `[models.py:ChatSession.message_count]` Counts only messages in `self.messages` where `type` is `MessageType.MESSAGE` or `MessageType.CALL` (excluding `MessageType.SYSTEM`).
- `[models.py:ChatSession.media_count]` Counts only messages in `self.messages` with a truthy `attachment` whose `media_type != MediaType.NONE`.

## Side Effects
- `[models.py:Attachment.exists_on_disk]` Performs read-only filesystem I/O via `self.filepath.exists()` when `self.filepath is not None`. No writes, network calls, or global state mutations exist in this package.

## Verification
- Run: `python3 -m unittest discover tests`
