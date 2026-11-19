#!/usr/bin/env python3
"""
Apple-Grade WhatsApp Chat Archival & Interactive Viewer CLI.
Transforms raw exported WhatsApp conversations into a private, local-first,
Cupertino-standard interactive HTML experience.

Usage:
    python main.py <chat_folder> [--output output.html] [--you "YourName"] [--embed-images]
"""

import sys
import argparse
from pathlib import Path
from converter import ChatConverterService


def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Transform WhatsApp chat exports into Apple-standard interactive HTML."
    )
    parser.add_argument(
        "chat_folder",
        help="Path to folder containing WhatsApp export (.txt and media files)"
    )
    parser.add_argument(
        "--output", "-o",
        default="chat.html",
        help="Output HTML file name (default: chat.html)"
    )
    parser.add_argument(
        "--you", "-y",
        default=None,
        help="Explicitly designate the sender name for right-aligned outgoing messages"
    )
    parser.add_argument(
        "--embed-images", "-e",
        action="store_true",
        help="Embed images directly as Base64 data URIs for completely standalone sharing"
    )
    parser.add_argument(
        "--dist", "-d",
        default="dist",
        help="Export a clean distribution folder ready to share directly (default: dist)"
    )
    parser.add_argument(
        "--no-dist",
        action="store_true",
        help="Perform in-place conversion directly inside chat_folder instead of exporting to dist"
    )
    parser.add_argument(
        "--zip", "-z",
        action="store_true",
        help="Compress the distribution folder into a .zip file for instant 1-click sharing"
    )
    parser.add_argument(
        "--no-launcher",
        action="store_true",
        help="Do not generate the outer 'Open Chat Here.html' redirect launcher file"
    )
    return parser.parse_args()


def main():
    args = parse_arguments()
    folder = Path(args.chat_folder)

    if not folder.exists() or not folder.is_dir():
        print(f"Error: Specified directory '{folder}' does not exist or is not a folder.", file=sys.stderr)
        sys.exit(1)

    dist_dir = None if args.no_dist else Path(args.dist)

    print("════════════════════════════════════════════════════════════════")
    print("  Apple Conversational Archival Engine — WhatsAppya")
    print("════════════════════════════════════════════════════════════════")
    print(f"• Source Folder   : {folder}")
    if dist_dir:
        print(f"• Distribution Dir: {dist_dir} (Ready to share)")
    else:
        print("• Mode            : In-place conversion")
    print(f"• Output Filename : {args.output}")
    print(f"• Embed Images    : {'Enabled (Standalone)' if args.embed_images else 'Disabled (Relative paths)'}")
    if dist_dir and args.zip:
        print("• Zip Archive     : Enabled (.zip for 1-click sharing)")

    try:
        service = ChatConverterService()
        output_path = service.convert(
            folder_path=folder,
            output_filename=args.output,
            you_name=args.you,
            embed_images=args.embed_images,
            create_launcher=not args.no_launcher,
            dist_dir=dist_dir,
            create_zip=args.zip
        )

        print("────────────────────────────────────────────────────────────────")
        print(f"✓ Archive successfully compiled : {output_path}")

        if dist_dir:
            launcher_file = dist_dir / "افتح المحادثة هنا - Open Chat Here.html"
            index_file = dist_dir / "index.html"
            zip_file = Path(f"{dist_dir}.zip")

            if launcher_file.exists():
                print(f"✓ Referral Launcher created     : {launcher_file}")
            if index_file.exists():
                print(f"✓ Web Index created             : {index_file}")
            if args.zip and zip_file.exists():
                print(f"✓ Standalone Zip archive        : {zip_file}")
            print("────────────────────────────────────────────────────────────────")
            print(f"  Share directly! Send the '{dist_dir}' folder" + (f" or '{zip_file.name}'" if args.zip else ""))
            print("  The recipient simply double-clicks the launcher to view the chat.")
        else:
            launcher_file = folder.parent / "افتح المحادثة هنا - Open Chat Here.html"
            if not args.no_launcher and launcher_file.exists():
                print(f"✓ Referral Launcher created     : {launcher_file}")
                print("  Tip: Keep the folder and launcher together; double-click the launcher to open!")
            else:
                print("  Open the file in Safari, Chrome, or Firefox to experience the chat.")
        print("════════════════════════════════════════════════════════════════")
    except Exception as e:
        print(f"\n[!] Conversion failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
