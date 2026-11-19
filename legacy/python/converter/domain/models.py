"""
Immutable Domain Models for Chat Archival Engine.
Designed with strict immutability, dataclasses, and type annotations.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, List, Dict
from .enums import MessageType, MediaType, Direction, DateOrder


@dataclass(frozen=True)
class Attachment:
    """Immutable representation of an associated media file or document."""
    filename: str
    filepath: Optional[Path] = None
    media_type: MediaType = MediaType.NONE
    file_size_bytes: int = 0
    mime_type: str = ""
    is_omitted: bool = False
    extra_data: Optional[str] = None

    @property
    def human_readable_size(self) -> str:
        """Formatted size string in B, KB, MB, or GB."""
        if self.file_size_bytes <= 0:
            return "0 KB"
        size = float(self.file_size_bytes)
        for unit in ["B", "KB", "MB", "GB"]:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"

    @property
    def exists_on_disk(self) -> bool:
        """Check if file physically exists on storage."""
        return self.filepath is not None and self.filepath.exists()


@dataclass(frozen=True)
class ChatMessage:
    """Immutable domain representation of a single conversation record."""
    raw_date: str
    raw_time: str
    sender: Optional[str] = None
    text: str = ""
    type: MessageType = MessageType.MESSAGE
    attachment: Optional[Attachment] = None
    is_deleted: bool = False
    is_call: bool = False
    call_description: Optional[str] = None
    is_edited: bool = False
    formatted_date: str = ""
    formatted_time: str = ""
    direction: Direction = Direction.RECEIVED


@dataclass
class ChatSession:
    """Aggregate root containing full conversation history and metadata."""
    title: str
    contact_name: str
    you_name: Optional[str]
    messages: List[ChatMessage] = field(default_factory=list)
    date_order: DateOrder = DateOrder.DAY_FIRST
    sender_counts: Dict[str, int] = field(default_factory=dict)

    @property
    def message_count(self) -> int:
        """Count of regular conversation messages and call entries."""
        return sum(1 for m in self.messages if m.type in (MessageType.MESSAGE, MessageType.CALL))

    @property
    def media_count(self) -> int:
        """Count of messages containing physical media attachments."""
        return sum(1 for m in self.messages if m.attachment and m.attachment.media_type != MediaType.NONE)
