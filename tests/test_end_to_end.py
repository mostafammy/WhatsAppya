"""
End-to-End Integration and Regression Test Suite.
Verifies conversion on real-world datasets with full component verification.
"""

import unittest
from pathlib import Path
from converter.service import ChatConverterService


class TestEndToEndConversion(unittest.TestCase):

    def test_synthetic_dataset_conversion(self):
        import tempfile
        project_root = Path(__file__).parent.parent
        with tempfile.TemporaryDirectory() as tmpdir:
            chat_dir = Path(tmpdir) / "WhatsApp Chat - Doctor Smith"
            chat_dir.mkdir()
            chat_txt = chat_dir / "_chat.txt"
            chat_txt.write_text(
                "[\u200f12/03/2025, 10:15:00 AM] Doctor Smith: Welcome to the lecture!\n"
                "[\u200f12/03/2025, 10:15:30 AM] You: Thank you Doctor.\n"
                "[\u200f12/03/2025, 10:16:00 AM] Doctor Smith: <المُرفق: lecture1.opus>\n"
                "[\u200f12/03/2025, 10:17:00 AM] Doctor Smith: Check out https://github.com/example/repo\n"
                "[\u200f12/03/2025, 10:18:00 AM] Doctor Smith: <المُرفق: 00000050-STICKER-2025-03-12-10-18-00.webp>\n",
                encoding="utf-8"
            )
            # Create a mock audio file and mock sticker webp file
            (chat_dir / "lecture1.opus").write_bytes(b"OggS" + b"\x00" * 100)
            (chat_dir / "00000050-STICKER-2025-03-12-10-18-00.webp").write_bytes(b"RIFF" + b"\x00" * 50)

            service = ChatConverterService()
            output_path = service.convert(
                folder_path=chat_dir,
                output_filename="chat.html",
                embed_images=False,
                assets_dir=project_root
            )

            self.assertTrue(output_path.exists())
            html = output_path.read_text(encoding="utf-8")
            self.assertIn("Doctor Smith", html)
            self.assertIn("apple-voice-player", html)
            self.assertIn("waveform-canvas", html)
            self.assertIn("speed-pill-btn", html)
            self.assertIn("rich-link-card", html)
            self.assertIn("github.com", html)
            self.assertIn("static-sticker", html)
            self.assertIn("sticker-container", html)
            self.assertIn("sticker-bubble", html)

            # Verify outer launcher file creation
            launcher = Path(tmpdir) / "افتح المحادثة هنا - Open Chat Here.html"
            self.assertTrue(launcher.exists())
            launcher_content = launcher.read_text(encoding="utf-8")
            self.assertIn("Doctor Smith", launcher_content)
            self.assertIn("chat.html", launcher_content)

    def test_dist_folder_export_and_zip(self):
        import tempfile
        project_root = Path(__file__).parent.parent
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            source_chat = tmp / "WhatsApp Chat - Professor John"
            source_chat.mkdir()
            (source_chat / "_chat.txt").write_text(
                "[\u200f01/01/2026, 12:00:00 PM] Professor John: Here is the lecture recording\n"
                "[\u200f01/01/2026, 12:01:00 PM] Professor John: <المُرفق: bio101.opus>\n",
                encoding="utf-8"
            )
            (source_chat / "bio101.opus").write_bytes(b"OggS" + b"\x00" * 80)

            dist_out = tmp / "dist"
            service = ChatConverterService()
            output_path = service.convert(
                folder_path=source_chat,
                output_filename="chat.html",
                assets_dir=project_root,
                dist_dir=dist_out,
                create_zip=True
            )

            # Check that output HTML is inside dist_out / source_chat.name
            self.assertTrue(output_path.exists())
            self.assertEqual(output_path.parent, dist_out / source_chat.name)

            # Check copied media asset in dist
            copied_media = dist_out / source_chat.name / "bio101.opus"
            self.assertTrue(copied_media.exists())

            # Check launcher in dist root
            dist_launcher = dist_out / "افتح المحادثة هنا - Open Chat Here.html"
            self.assertTrue(dist_launcher.exists())

            # Check index.html in dist root
            dist_index = dist_out / "index.html"
            self.assertTrue(dist_index.exists())

            # Check zip archive
            dist_zip = tmp / "dist.zip"
            self.assertTrue(dist_zip.exists())
            self.assertGreater(dist_zip.stat().st_size, 0)

    def test_real_world_dataset_conversion(self):
        project_root = Path(__file__).parent.parent
        target_folder = project_root / "WhatsAppChat" / "WhatsApp Chat - ايمن الششتاوى قطور"

        if not target_folder.exists():
            self.skipTest(f"Test dataset not found at {target_folder}")

        service = ChatConverterService()
        output_path = service.convert(
            folder_path=target_folder,
            output_filename="test_output.html",
            embed_images=False,
            assets_dir=project_root
        )

        self.assertTrue(output_path.exists())
        content = output_path.read_text(encoding="utf-8")

        # Assertions on HTML contents
        self.assertIn("apple-voice-player", content)
        self.assertIn("waveform-canvas", content)
        self.assertIn("speed-pill-btn", content)
        self.assertIn("2024 messages", content)
        self.assertIn("ايمن الششتاوى قطور", content)

        # Cleanup test output
        output_path.unlink()


if __name__ == "__main__":
    unittest.main()
