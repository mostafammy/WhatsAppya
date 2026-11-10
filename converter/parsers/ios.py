"""
iOS WhatsApp Chat Parser Strategy.
Handles bracketed timestamps, Unicode Bidirectional markers, Arabic/Latin locales,
seconds precision, and multiline message continuation.
"""

import re
from pathlib import Path
from typing import List, Optional
from .base import IChatParser
from ..domain.models import ChatMessage
from ..domain.enums import MessageType


class IOSChatParser(IChatParser):
    """Parses WhatsApp export files generated on iOS devices."""

    BIDI_CHARS = '\u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff'
    BIDI_REGEX = re.compile(f'[{BIDI_CHARS}]')

    # Matches: [DD/MM/YY, HH:MM:SS AM] or [M/D/YY، H:MM:SS م]
    LINE_PATTERN = re.compile(
        r'^\[([0-9]{1,4}[/.-][0-9]{1,2}[/.-][0-9]{1,4})[,\s،]+([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?(?:\s*(?:[apAP]\.?[mM]\.?|[صم]))?)\]\s*(.*)$'
    )

    ENCRYPTION_KEYWORDS = [
        'الرسائل والمكالمات مشفرة',
        'end-to-end encrypted',
        'chiffrés de bout en bout',
        'verschlüsselt',
        'crittografati end-to-end'
    ]

    DELETED_KEYWORDS = [
        'This message was deleted',
        'You deleted this message',
        'تم حذف هذه الرسالة',
        'حذف هذه الرسالة',
        'لقد حذفت هذه الرسالة'
    ]

    CALL_KEYWORDS = [
        'مكالمة صوتية',
        'مكالمة فيديو',
        'Missed voice call',
        'Missed video call',
        'Voice call',
        'Video call'
    ]

    EDITED_PATTERN = re.compile(
        r'\s*<(?:\s*(?:This message was edited|تم تعديل هذه الرسالة|Ce message a été modifié|Diese Nachricht wurde bearbeitet|Questo messaggio è stato modificato|Este mensaje fue editado|Esta mensagem foi editada)\s*)>\s*$',
        re.IGNORECASE
    )

    @property
    def name(self) -> str:
        return "iOS WhatsApp Parser"

    def can_handle(self, sample_lines: List[str]) -> bool:
        """Determines if at least 25% of sample non-empty lines match iOS bracket pattern."""
        matches = 0
        total = 0
        for line in sample_lines:
            clean = self.BIDI_REGEX.sub('', line).strip()
            if not clean:
                continue
            total += 1
            if self.LINE_PATTERN.match(clean):
                matches += 1
        return total > 0 and (matches / total) >= 0.25

    def parse(self, chat_file: Path) -> List[ChatMessage]:
        messages: List[ChatMessage] = []
        current_data: Optional[dict] = None

        with open(chat_file, 'r', encoding='utf-8') as f:
            for line in f:
                raw_line = line.rstrip('\r\n')
                clean_line = self.BIDI_REGEX.sub('', raw_line).strip()

                match = self.LINE_PATTERN.match(clean_line)
                if match:
                    if current_data:
                        messages.append(self._build_message(current_data))

                    date_str, time_str, rest = match.groups()
                    current_data = {
                        'date': date_str,
                        'time': time_str,
                        'raw_rest': rest
                    }
                    continue

                # Continuation line
                if current_data and raw_line:
                    current_data['raw_rest'] += '\n' + raw_line

        if current_data:
            messages.append(self._build_message(current_data))

        return messages

    def _build_message(self, data: dict) -> ChatMessage:
        date_str = data['date']
        time_str = data['time']
        rest = data['raw_rest']

        # Check for system encryption banner
        is_encryption = any(phrase in rest for phrase in self.ENCRYPTION_KEYWORDS)
        colon_idx = rest.find(':')

        if is_encryption:
            text = rest[colon_idx + 1:].strip() if colon_idx != -1 else rest.strip()
            return ChatMessage(
                raw_date=date_str,
                raw_time=time_str,
                sender=None,
                text=text,
                type=MessageType.SYSTEM
            )

        if colon_idx != -1:
            sender = rest[:colon_idx].strip()
            text = rest[colon_idx + 1:].strip()

            is_edited = bool(self.EDITED_PATTERN.search(text))
            if is_edited:
                text = self.EDITED_PATTERN.sub('', text).strip()

            is_del = any(phrase in text for phrase in self.DELETED_KEYWORDS)
            is_cl = any(phrase in text for phrase in self.CALL_KEYWORDS)

            return ChatMessage(
                raw_date=date_str,
                raw_time=time_str,
                sender=sender,
                text=text,
                type=MessageType.CALL if is_cl else MessageType.MESSAGE,
                is_deleted=is_del,
                is_call=is_cl,
                call_description=text if is_cl else None,
                is_edited=is_edited
            )

        # No colon -> System message
        return ChatMessage(
            raw_date=date_str,
            raw_time=time_str,
            sender=None,
            text=rest.strip(),
            type=MessageType.SYSTEM
        )
