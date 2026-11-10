"""
Parser Factory and Heuristic Strategy Selector.
Implements the Factory Method pattern to dynamically resolve the appropriate
parser strategy based on content inspection.
"""

from pathlib import Path
from typing import List, Type
from .base import IChatParser
from .ios import IOSChatParser
from .android import AndroidChatParser


class ParserFactory:
    """Factory responsible for selecting and instantiating chat parsers."""

    def __init__(self, custom_parsers: List[Type[IChatParser]] = None):
        self._parsers: List[IChatParser] = [
            IOSChatParser(),
            AndroidChatParser()
        ]
        if custom_parsers:
            for parser_cls in custom_parsers:
                self._parsers.insert(0, parser_cls())

    def register_parser(self, parser: IChatParser) -> None:
        """Register a new parser strategy (Open/Closed Principle)."""
        self._parsers.insert(0, parser)

    def get_parser(self, chat_file: Path) -> IChatParser:
        """
        Inspect the beginning of the file and return the best-matching parser strategy.
        """
        sample_lines: List[str] = []
        with open(chat_file, 'r', encoding='utf-8', errors='replace') as f:
            for _ in range(50):
                line = f.readline()
                if not line:
                    break
                sample_lines.append(line)

        for parser in self._parsers:
            if parser.can_handle(sample_lines):
                return parser

        # Fallback default: iOS parser handles most complex bracketed exports
        return self._parsers[0]
