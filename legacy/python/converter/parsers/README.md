# converter/parsers

## Overview
The `converter.parsers` package implements the Strategy and Factory Method layers for parsing exported WhatsApp chat text files into `ChatMessage` domain entities. It defines the abstract `IChatParser` contract, concrete iOS (bracketed timestamp) and Android (hyphen-delimited timestamp) parser strategies, and `ParserFactory` for heuristic parser selection and registration.

## Interface
- `[__init__.py:__all__]` Re-exports `IChatParser`, `IOSChatParser`, `AndroidChatParser`, and `ParserFactory` (`__all__ = ['IChatParser', 'IOSChatParser', 'AndroidChatParser', 'ParserFactory']`).
- `[base.py:IChatParser]` Abstract base class (`ABC`) importing `ChatMessage` from `..domain.models`; defines abstract property `name(self) -> str`, abstract method `can_handle(self, sample_lines: List[str]) -> bool`, and abstract method `parse(self, chat_file: Path) -> List[ChatMessage]`.
- `[ios.py:IOSChatParser]` Subclass of `IChatParser` for bracketed iOS exports (`[date, time] rest`). Defines class attributes `BIDI_CHARS`, `BIDI_REGEX`, `LINE_PATTERN`, `ENCRYPTION_KEYWORDS`, `DELETED_KEYWORDS`, `CALL_KEYWORDS`, `EDITED_PATTERN`; public interface `name -> str` (`'iOS WhatsApp Parser'`), `can_handle(self, sample_lines: List[str]) -> bool`, `parse(self, chat_file: Path) -> List[ChatMessage]`; and internal helper `_build_message(self, data: dict) -> ChatMessage`.
- `[android.py:AndroidChatParser]` Subclass of `IChatParser` for hyphen-delimited Android exports (`date, time - rest`). Defines class attributes `BIDI_CHARS`, `BIDI_REGEX`, `LINE_PATTERN`, `ENCRYPTION_KEYWORDS`, `DELETED_KEYWORDS`, `CALL_KEYWORDS`, `EDITED_PATTERN`; public interface `name -> str` (`'Android WhatsApp Parser'`), `can_handle(self, sample_lines: List[str]) -> bool`, `parse(self, chat_file: Path) -> List[ChatMessage]`; and internal helper `_build_message(self, data: dict) -> ChatMessage`.
- `[factory.py:ParserFactory]` Parser selector and registry exposing `__init__(self, custom_parsers: List[Type[IChatParser]] = None)`, `register_parser(self, parser: IChatParser) -> None`, and `get_parser(self, chat_file: Path) -> IChatParser`.

## Invariants
- `[base.py:IChatParser]` Subclasses must implement the `name` property plus `can_handle` and `parse` methods enforced by `ABC`/`@abstractmethod`.
- `[ios.py:IOSChatParser.can_handle]` Requires at least one non-empty line after `BIDI_REGEX` stripping and `.strip()` (`total > 0`) and `(matches / total) >= 0.25` against `LINE_PATTERN`.
- `[android.py:AndroidChatParser.can_handle]` Requires at least one non-empty line after `BIDI_REGEX` stripping and `.strip()` (`total > 0`) and `(matches / total) >= 0.25` against `LINE_PATTERN`.
- `[ios.py:IOSChatParser.parse]` Strips `\r\n` for `raw_line` and strips `BIDI_REGEX` plus outer whitespace for `clean_line` header matching; non-empty `raw_line` entries before the first `LINE_PATTERN` match are ignored, and empty lines are skipped as multiline continuations (`if current_data and raw_line`).
- `[android.py:AndroidChatParser.parse]` Strips `\r\n` for `raw_line` and strips `BIDI_REGEX` plus outer whitespace for `clean_line` header matching; non-empty `raw_line` entries before the first `LINE_PATTERN` match are ignored, and empty lines are skipped as multiline continuations (`if current_data and raw_line`).
- `[ios.py:IOSChatParser._build_message]` Evaluates `ENCRYPTION_KEYWORDS` before `:` splitting (returning `MessageType.SYSTEM` with `sender=None`, slicing after the first `:` if present); otherwise splits on the first `:` into `sender` and `text`, strips trailing `EDITED_PATTERN` before checking `DELETED_KEYWORDS` and `CALL_KEYWORDS`, sets `type=MessageType.CALL` and `call_description=text` when `is_cl` is true (else `MessageType.MESSAGE` and `None`), and emits `MessageType.SYSTEM` with `sender=None` when `:` is absent.
- `[android.py:AndroidChatParser._build_message]` Evaluates `ENCRYPTION_KEYWORDS` before `:` splitting (returning `MessageType.SYSTEM` with `sender=None`, slicing after the first `:` if present); otherwise splits on the first `:` into `sender` and `text`, strips trailing `EDITED_PATTERN` before checking `DELETED_KEYWORDS` and `CALL_KEYWORDS`, sets `type=MessageType.CALL` and `call_description=text` when `is_cl` is true (else `MessageType.MESSAGE` and `None`), and emits `MessageType.SYSTEM` with `sender=None` when `:` is absent.
- `[factory.py:ParserFactory.__init__]` Seeds `self._parsers` with `[IOSChatParser(), AndroidChatParser()]` and instantiates each class in `custom_parsers` with zero arguments via `insert(0, parser_cls())`, giving later entries in `custom_parsers` higher precedence.
- `[factory.py:ParserFactory.get_parser]` Reads up to the first 50 lines (`range(50)`) with `encoding='utf-8'` and `errors='replace'`; returns the first parser in `self._parsers` whose `can_handle(sample_lines)` returns `True`, or falls back unconditionally to `self._parsers[0]` (`IOSChatParser` by default when no custom parsers are prepended).

## Side Effects
- `[ios.py:IOSChatParser.parse]` Performs read-only disk I/O via `open(chat_file, 'r', encoding='utf-8')` without an error-replacement handler (invalid UTF-8 raises `UnicodeDecodeError`; missing or unreadable files raise `OSError`).
- `[android.py:AndroidChatParser.parse]` Performs read-only disk I/O via `open(chat_file, 'r', encoding='utf-8')` without an error-replacement handler (invalid UTF-8 raises `UnicodeDecodeError`; missing or unreadable files raise `OSError`).
- `[factory.py:ParserFactory.get_parser]` Performs read-only disk I/O via `open(chat_file, 'r', encoding='utf-8', errors='replace')` for up to 50 lines (missing or unreadable files raise `OSError`).
- `[factory.py:ParserFactory.__init__]` Instantiates `IOSChatParser()`, `AndroidChatParser()`, and any `custom_parsers` classes, mutating `self._parsers` via `insert(0, ...)` when `custom_parsers` is truthy.
- `[factory.py:ParserFactory.register_parser]` Mutates `self._parsers` in-place by inserting `parser` at index `0`.

## Verification
- Run: `python3 -m unittest discover tests`
