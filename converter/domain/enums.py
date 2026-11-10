"""
Domain Enumerations for WhatsApp Chat Archival Engine.
Follows Apple Human Interface Guidelines and Domain-Driven Design principles.
"""

from enum import Enum, auto


class MessageType(Enum):
    """Classification of conversation entries."""
    MESSAGE = "message"
    SYSTEM = "system"
    CALL = "call"


class MediaType(Enum):
    """Classification of media attachments."""
    NONE = "none"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    PDF = "pdf"
    DOCUMENT = "document"
    FILE = "file"
    OMITTED = "omitted"
    STICKER = "sticker"


class Direction(Enum):
    """Visual alignment direction according to conversational perspective."""
    SENT = "sent"          # Outgoing message (Right-aligned, green bubble)
    RECEIVED = "received"  # Incoming message (Left-aligned, white/gray bubble)


class DateOrder(Enum):
    """Calendar ordering convention detected from raw timestamps."""
    DAY_FIRST = "day_first"      # DD/MM/YYYY (Standard UK, EU, Middle East)
    MONTH_FIRST = "month_first"  # MM/DD/YYYY (Standard US)
    YEAR_FIRST = "year_first"    # YYYY/MM/DD (ISO standard)
