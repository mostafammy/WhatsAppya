"""
Parser Strategy Layer for Chat Archival Engine.
"""

from .base import IChatParser
from .ios import IOSChatParser
from .android import AndroidChatParser
from .factory import ParserFactory

__all__ = [
    "IChatParser",
    "IOSChatParser",
    "AndroidChatParser",
    "ParserFactory",
]
