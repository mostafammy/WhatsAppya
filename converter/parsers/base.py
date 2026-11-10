"""
Abstract Base Parser Interface (Strategy Pattern).
Defines the contract for all platform and format-specific chat parsers.
"""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import List
from ..domain.models import ChatMessage


class IChatParser(ABC):
    """Abstract interface defining chat parsing strategy."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable strategy identifier."""
        pass

    @abstractmethod
    def can_handle(self, sample_lines: List[str]) -> bool:
        """
        Heuristic check to determine if this parser strategy
        is capable of processing the given sample export lines.
        """
        pass

    @abstractmethod
    def parse(self, chat_file: Path) -> List[ChatMessage]:
        """
        Parse raw chat export text file into a sequence of ChatMessage domain entities.
        """
        pass
