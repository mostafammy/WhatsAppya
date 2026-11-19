"""
Unit tests for Pipeline Layer: MediaResolver and RichLinkExtractor.
"""

import unittest
from pathlib import Path
import tempfile
from converter.pipeline.media import MediaResolver
from converter.pipeline.link import RichLinkExtractor
from converter.domain.enums import MediaType


class TestPipeline(unittest.TestCase):

    def test_rich_link_extractor(self):
        text = "Visit https://github.com/developer/repo and check https://youtube.com/watch?v=123"
        links = RichLinkExtractor.extract_urls(text)
        self.assertEqual(len(links), 2)

        self.assertEqual(links[0]['domain'], 'github.com')
        self.assertEqual(links[0]['category'], 'code')

        self.assertEqual(links[1]['domain'], 'youtube.com')
        self.assertEqual(links[1]['category'], 'video')

        formatted = RichLinkExtractor.format_inline_links("Go to https://apple.com")
        self.assertIn('<a href="https://apple.com"', formatted)

    def test_media_resolver(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            sample_img = tmp_path / "photo.jpg"
            sample_img.write_bytes(b"\xFF\xD8\xFF\xE0" + b"\x00" * 100)

            sample_audio = tmp_path / "voice.opus"
            sample_audio.write_bytes(b"OggS" + b"\x00" * 50)

            resolver = MediaResolver(tmp_path)

            # Test iOS attachment syntax
            ios_text = "<المُرفق: photo.jpg>"
            att, clean_text = resolver.resolve(ios_text)
            self.assertIsNotNone(att)
            self.assertEqual(att.media_type, MediaType.IMAGE)
            self.assertEqual(clean_text, "")

            # Test Audio attachment syntax
            audio_text = "<المُرفق: voice.opus>"
            att_audio, _ = resolver.resolve(audio_text)
            self.assertIsNotNone(att_audio)
            self.assertEqual(att_audio.media_type, MediaType.AUDIO)

            # Test Omitted media
            omitted_text = "لم يتم إدراج الصورة"
            att_omitted, _ = resolver.resolve(omitted_text)
            self.assertIsNotNone(att_omitted)
            self.assertEqual(att_omitted.media_type, MediaType.OMITTED)

            # Test WhatsApp Animated Sticker (.was)
            import zipfile
            sample_was = tmp_path / "STK-test.was"
            with zipfile.ZipFile(sample_was, "w") as z:
                z.writestr("animation/animation.json", '{"v":"5.1.0","layers":[]}')

            was_text = "STK-test.was (file attached)"
            att_was, _ = resolver.resolve(was_text)
            self.assertIsNotNone(att_was)
            self.assertEqual(att_was.media_type, MediaType.STICKER)
            self.assertIsNotNone(att_was.extra_data)
            self.assertIn('"layers"', att_was.extra_data)

            # Test WhatsApp Static Sticker (.webp with STK- prefix)
            sample_stk_webp = tmp_path / "STK-sample.webp"
            sample_stk_webp.write_bytes(b"RIFF" + b"\x00" * 30)

            webp_text = "STK-sample.webp (file attached)"
            att_webp, _ = resolver.resolve(webp_text)
            self.assertIsNotNone(att_webp)
            self.assertEqual(att_webp.media_type, MediaType.STICKER)

            # Test iOS WhatsApp Sticker (00000123-STICKER-....webp or regular .webp)
            sample_ios_sticker = tmp_path / "00000123-STICKER-2025-01-01-12-00-00.webp"
            sample_ios_sticker.write_bytes(b"RIFF" + b"\x00" * 30)

            ios_sticker_text = "<المُرفق: 00000123-STICKER-2025-01-01-12-00-00.webp>"
            att_ios, _ = resolver.resolve(ios_sticker_text)
            self.assertIsNotNone(att_ios)
            self.assertEqual(att_ios.media_type, MediaType.STICKER)

            # Test Sticker Omitted phrase
            omitted_stk_text = "لم يتم إدراج الملصق"
            att_omitted_stk, _ = resolver.resolve(omitted_stk_text)
            self.assertIsNotNone(att_omitted_stk)
            self.assertEqual(att_omitted_stk.media_type, MediaType.OMITTED)


if __name__ == "__main__":
    unittest.main()
