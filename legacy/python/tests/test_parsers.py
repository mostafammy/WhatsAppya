"""
Unit tests for Parser Strategy Layer.
Tests iOS and Android parsers across multiple locales, BiDi marks, and edge cases.
"""

import unittest
from pathlib import Path
import tempfile
from converter.parsers.ios import IOSChatParser
from converter.parsers.android import AndroidChatParser
from converter.parsers.factory import ParserFactory
from converter.domain.enums import MessageType


class TestChatParsers(unittest.TestCase):

    def test_ios_parser_can_handle(self):
        parser = IOSChatParser()
        sample = [
            "[2/11/25, 2:22:13 PM] Alice: Hello there",
            "[2/11/25, 2:23:00 PM] Bob: Hi Alice"
        ]
        self.assertTrue(parser.can_handle(sample))

        android_sample = [
            "2/11/25, 2:22 PM - Alice: Hello there",
            "2/11/25, 2:23 PM - Bob: Hi Alice"
        ]
        self.assertFalse(parser.can_handle(android_sample))

    def test_ios_parser_arabic_and_bidi(self):
        parser = IOSChatParser()
        content = (
            "[\u200f2/11/25، 2:22:13\xa0م] ايمن: \u200fصباح الخير\n"
            "[\u200f2/11/25، 2:22:20\xa0م] مصطفى: صباح الورد\n"
            "[\u200f2/11/25، 2:22:30\xa0م] ايمن: \u200fتم حذف هذه الرسالة.\n"
            "[\u200f2/11/25، 2:23:00\xa0م] مصطفى: \u200fمكالمة صوتية, ‏لم يتم الرد\n"
        )
        with tempfile.NamedTemporaryFile("w+", encoding="utf-8", delete=False) as tf:
            tf.write(content)
            tf.flush()
            temp_path = Path(tf.name)

        try:
            messages = parser.parse(temp_path)
            self.assertEqual(len(messages), 4)

            # Check message 1
            self.assertEqual(messages[0].sender, "ايمن")
            self.assertEqual(messages[0].text, "صباح الخير")
            self.assertEqual(messages[0].type, MessageType.MESSAGE)

            # Check deleted message
            self.assertTrue(messages[2].is_deleted)

            # Check call notice
            self.assertTrue(messages[3].is_call)
            self.assertEqual(messages[3].type, MessageType.CALL)
        finally:
            temp_path.unlink()

    def test_edited_message_handling(self):
        android_parser = AndroidChatParser()
        content = (
            "2/28/26, 4:01 PM - Mostafa: ما فيه بليز اهو 😂😂😂 <This message was edited>\n"
            "2/28/26, 4:02 PM - Alice: Here is another one <تم تعديل هذه الرسالة>\n"
        )
        with tempfile.NamedTemporaryFile("w+", encoding="utf-8", delete=False) as tf:
            tf.write(content)
            tf.flush()
            temp_path = Path(tf.name)

        try:
            messages = android_parser.parse(temp_path)
            self.assertEqual(len(messages), 2)
            self.assertTrue(messages[0].is_edited)
            self.assertEqual(messages[0].text, "ما فيه بليز اهو 😂😂😂")
            self.assertTrue(messages[1].is_edited)
            self.assertEqual(messages[1].text, "Here is another one")
        finally:
            temp_path.unlink()

    def test_android_parser(self):
        parser = AndroidChatParser()
        content = (
            "11/02/2025, 14:22 - Alice: Hi from Android\n"
            "11/02/2025, 14:23 - Bob: Looks great\n"
            "11/02/2025, 14:24 - Messages and calls are end-to-end encrypted.\n"
        )
        with tempfile.NamedTemporaryFile("w+", encoding="utf-8", delete=False) as tf:
            tf.write(content)
            tf.flush()
            temp_path = Path(tf.name)

        try:
            self.assertTrue(parser.can_handle(content.splitlines()))
            messages = parser.parse(temp_path)
            self.assertEqual(len(messages), 3)
            self.assertEqual(messages[0].sender, "Alice")
            self.assertEqual(messages[2].type, MessageType.SYSTEM)
        finally:
            temp_path.unlink()

    def test_parser_factory(self):
        factory = ParserFactory()
        ios_sample = "[\u200f2/11/25، 2:22:13\xa0م] Contact: Test message\n"
        with tempfile.NamedTemporaryFile("w+", encoding="utf-8", delete=False) as tf:
            tf.write(ios_sample)
            tf.flush()
            temp_path = Path(tf.name)

        try:
            resolved = factory.get_parser(temp_path)
            self.assertIsInstance(resolved, IOSChatParser)
        finally:
            temp_path.unlink()


if __name__ == "__main__":
    unittest.main()
