#!/usr/bin/env python3
"""
WhatsApp Chat to HTML Converter
Converts WhatsApp exported chat (.txt) with media files to an interactive HTML page.

Usage:
    python whatsapp_to_html.py <chat_folder> [--output output.html] [--you "YourName"]

Example:
    python whatsapp_to_html.py "./WhatsApp Chat" --you "lxay" --output chat.html
"""

import re
import os
import sys
import argparse
from datetime import datetime
from pathlib import Path
from html import escape
import base64
from urllib.parse import quote


def parse_arguments():
    parser = argparse.ArgumentParser(description='Convert WhatsApp chat export to HTML')
    parser.add_argument('chat_folder', help='Path to the folder containing chat.txt and media files')
    parser.add_argument('--output', '-o', default='chat.html', help='Output HTML file name (default: chat.html)')
    parser.add_argument('--you', '-y', default=None, help='Your name/sender name to show on right side')
    parser.add_argument('--embed-images', '-e', action='store_true',
                        help='Embed images as base64 (larger file, but standalone)')
    return parser.parse_args()


def find_chat_file(folder):
    """Find the .txt chat file in the folder"""
    folder = Path(folder)
    txt_files = list(folder.glob('*.txt'))
    if not txt_files:
        raise FileNotFoundError(f"No .txt file found in {folder}")
    # Prefer files with 'WhatsApp' in name
    for f in txt_files:
        if 'whatsapp' in f.name.lower():
            return f
    return txt_files[0]


def parse_chat(chat_file):
    """Parse WhatsApp chat export file"""
    # Pattern: DD/MM/YY, HH:MM - Sender: Message
    message_pattern = re.compile(r'^(\d{1,2}/\d{1,2}/\d{2,4}),?\s+(\d{1,2}:\d{2})\s*-\s*(.+?):\s*(.*)$')
    system_pattern = re.compile(r'^(\d{1,2}/\d{1,2}/\d{2,4}),?\s+(\d{1,2}:\d{2})\s*-\s*(.+)$')

    messages = []
    current_message = None

    with open(chat_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')

            # Try to match a new message
            match = message_pattern.match(line)
            if match:
                # Save previous message
                if current_message:
                    messages.append(current_message)

                date_str, time_str, sender, text = match.groups()
                current_message = {
                    'date': date_str,
                    'time': time_str,
                    'sender': sender.strip(),
                    'text': text,
                    'type': 'message'
                }
                continue

            # Try system message (no sender)
            sys_match = system_pattern.match(line)
            if sys_match and not message_pattern.match(line):
                if current_message:
                    messages.append(current_message)

                date_str, time_str, text = sys_match.groups()
                current_message = {
                    'date': date_str,
                    'time': time_str,
                    'sender': None,
                    'text': text,
                    'type': 'system'
                }
                continue

            # Continuation of previous message (multi-line)
            if current_message and line:
                current_message['text'] += '\n' + line

    # Don't forget last message
    if current_message:
        messages.append(current_message)

    return messages


def detect_media(text, folder):
    """Detect media files referenced in message"""
    media_info = {
        'has_media': False,
        'media_type': None,
        'filename': None,
        'filepath': None,
        'clean_text': text
    }

    # Check for "(file attached)" pattern
    attached_match = re.search(r'(.+?)\s*\(file attached\)', text)
    if attached_match:
        filename = attached_match.group(1).strip()
        filepath = folder / filename

        if filepath.exists():
            media_info['has_media'] = True
            media_info['filename'] = filename
            media_info['filepath'] = filepath

            # Determine type
            ext = filepath.suffix.lower()
            if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                media_info['media_type'] = 'image'
            elif ext in ['.mp4', '.mov', '.avi', '.mkv', '.3gp']:
                media_info['media_type'] = 'video'
            elif ext in ['.mp3', '.ogg', '.opus', '.wav', '.m4a']:
                media_info['media_type'] = 'audio'
            elif ext in ['.pdf']:
                media_info['media_type'] = 'pdf'
            elif ext in ['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt']:
                media_info['media_type'] = 'document'
            else:
                media_info['media_type'] = 'file'

            # Clean text (remove filename and "file attached")
            media_info['clean_text'] = re.sub(r'.+?\s*\(file attached\)', '', text).strip()

    # Check for <Media omitted>
    if '<Media omitted>' in text:
        media_info['has_media'] = True
        media_info['media_type'] = 'omitted'
        media_info['clean_text'] = text.replace('<Media omitted>', '').strip()

    return media_info


def detect_links(text):
    """Convert URLs in text to clickable links"""
    url_pattern = re.compile(r'(https?://[^\s<>"{}|\\^`\[\]]+)')

    def replace_url(match):
        url = match.group(1)
        return f'<a href="{escape(url)}" target="_blank" rel="noopener">{escape(url)}</a>'

    return url_pattern.sub(replace_url, escape(text))


def format_message_text(text):
    """Format message text with links and line breaks"""
    # First escape HTML, then add links, then line breaks
    text = detect_links(text)
    text = text.replace('\n', '<br>')
    return text


def get_html_template():
    """Return the HTML template with inlined CSS and JS from external files"""
    base_path = Path(__file__).parent

    # Read template
    template_path = base_path / 'template.html'
    with open(template_path, 'r', encoding='utf-8') as f:
        template = f.read()

    # Read CSS
    css_path = base_path / 'style.css'
    with open(css_path, 'r', encoding='utf-8') as f:
        css_content = f.read()

    # Read JS
    js_path = base_path / 'script.js'
    with open(js_path, 'r', encoding='utf-8') as f:
        js_content = f.read()

    # Escape curly braces for .format() - double them up
    css_content = css_content.replace('{', '{{').replace('}', '}}')
    js_content = js_content.replace('{', '{{').replace('}', '}}')

    # Replace external links with inline content
    template = template.replace('<link rel="stylesheet" href="style.css">',
                                f'<style>\n{css_content}\n    </style>')
    template = template.replace('<script src="script.js"></script>',
                                f'<script>\n{js_content}\n    </script>')

    return template


def get_file_size(filepath):
    """Get human-readable file size"""
    size = os.path.getsize(filepath)
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def render_media(media_info, embed_images=False):
    """Render media HTML based on type"""
    if not media_info['has_media']:
        return ''

    if media_info['media_type'] == 'omitted':
        return '<div class="media-omitted">📎 Media omitted</div>'

    filepath = media_info['filepath']
    filename = media_info['filename']
    media_type = media_info['media_type']

    # URL-encode the filename for href
    encoded_filename = quote(filename)

    if media_type == 'image':
        if embed_images:
            with open(filepath, 'rb') as f:
                b64 = base64.b64encode(f.read()).decode()
            ext = filepath.suffix.lower().replace('.', '')
            mime = f'image/{ext}' if ext != 'jpg' else 'image/jpeg'
            src = f'data:{mime};base64,{b64}'
        else:
            src = encoded_filename
        return f'''<div class="media-container">
            <img src="{src}" alt="{escape(filename)}" onclick="openMedia('{src}', 'image')" loading="lazy">
        </div>'''

    elif media_type == 'video':
        return f'''<div class="media-container">
            <div class="video-thumbnail" onclick="openMedia('{encoded_filename}', 'video')">
                <video src="{encoded_filename}" preload="metadata"></video>
            </div>
        </div>'''

    elif media_type == 'audio':
        return f'''<div class="media-container">
            <audio src="{encoded_filename}" controls preload="metadata"></audio>
        </div>'''

    elif media_type in ['pdf', 'document', 'file']:
        size = get_file_size(filepath)
        ext = filepath.suffix.lower().replace('.', '') or 'file'
        icon_class = 'pdf' if ext == 'pdf' else 'doc' if ext in ['doc', 'docx'] else 'xls' if ext in ['xls',
                                                                                                      'xlsx'] else 'ppt' if ext in [
            'ppt', 'pptx'] else 'file'
        return f'''<a href="{encoded_filename}" target="_blank" class="document-link">
            <div class="document-icon {icon_class}">{ext.upper()[:4]}</div>
            <div class="document-info">
                <div class="document-name">{escape(filename)}</div>
                <div class="document-size">{size}</div>
            </div>
        </a>'''

    return ''


def generate_html(messages, folder, you_name=None, embed_images=False):
    """Generate HTML from parsed messages"""
    folder = Path(folder)

    # Detect "you" sender if not specified
    if you_name is None:
        # Find most common sender
        senders = {}
        for msg in messages:
            if msg['sender'] and msg['type'] == 'message':
                senders[msg['sender']] = senders.get(msg['sender'], 0) + 1
        if senders:
            # Assume the one with fewer messages is "you" (usually the case)
            you_name = min(senders, key=senders.get)

    # Get chat name (the other person)
    other_name = None
    for msg in messages:
        if msg['sender'] and msg['sender'] != you_name:
            other_name = msg['sender']
            break

    chat_name = other_name or "WhatsApp Chat"

    html_messages = []
    current_date = None

    for msg in messages:
        # Date separator
        if msg['date'] != current_date:
            current_date = msg['date']
            # Parse and format date nicely
            try:
                dt = datetime.strptime(msg['date'], '%d/%m/%y')
                formatted_date = dt.strftime('%B %d, %Y')
            except:
                formatted_date = msg['date']

            html_messages.append(f'''<div class="date-separator">
                <span>{formatted_date}</span>
            </div>''')

        # System message
        if msg['type'] == 'system':
            html_messages.append(f'''<div class="system-message">
                <span>{escape(msg['text'])}</span>
            </div>''')
            continue

        # Regular message
        is_sent = msg['sender'] == you_name
        direction = 'sent' if is_sent else 'received'

        # Check for media
        media_info = detect_media(msg['text'], folder)

        # Check for deleted message
        is_deleted = 'This message was deleted' in msg['text']

        # Build message content
        content_parts = []

        # Sender name (only for received messages in group-like view)
        if not is_sent and msg['sender']:
            content_parts.append(f'<div class="sender-name">{escape(msg["sender"])}</div>')

        # Media
        if media_info['has_media']:
            content_parts.append(render_media(media_info, embed_images))

        # Text content
        text = media_info['clean_text']
        if text:
            if is_deleted:
                content_parts.append(f'<div class="message-text deleted-message">🚫 {escape(text)}</div>')
            else:
                content_parts.append(f'<div class="message-text">{format_message_text(text)}</div>')

        # Time
        content_parts.append(f'<div class="message-time">{msg["time"]}</div>')

        html_messages.append(f'''<div class="message {direction}">
            <div class="message-bubble">
                {''.join(content_parts)}
            </div>
        </div>''')

    # Fill template
    template = get_html_template()
    return template.format(
        title=f"Chat with {chat_name}",
        chat_name=chat_name,
        message_count=len([m for m in messages if m['type'] == 'message']),
        messages='\n'.join(html_messages)
    )


def main():
    args = parse_arguments()

    folder = Path(args.chat_folder)
    if not folder.exists():
        print(f"Error: Folder '{folder}' not found")
        sys.exit(1)

    # Find chat file
    try:
        chat_file = find_chat_file(folder)
        print(f"Found chat file: {chat_file}")
    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)

    # Parse chat
    print("Parsing chat...")
    messages = parse_chat(chat_file)
    print(f"Found {len(messages)} messages")

    # Generate HTML
    print("Generating HTML...")
    html = generate_html(messages, folder, args.you, args.embed_images)

    # Write output
    output_path = folder / args.output
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"✓ HTML file generated: {output_path}")
    print(f"  Open this file in a browser to view the chat.")
    print(f"  Make sure media files are in the same folder as the HTML file.")


if __name__ == '__main__':
    main()