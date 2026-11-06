#!/usr/bin/env python3
"""
WhatsApp Chat to HTML Converter
Converts WhatsApp exported chat (.txt) with media files to an interactive HTML page.

Usage:
    python main.py <chat_folder> [--output output.html] [--you "YourName"] [--embed-images]

Example:
    python main.py "./WhatsAppChat/WhatsApp Chat - ايمن الششتاوى قطور" --output chat.html
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

BIDI_CHARS = '\u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff'
BIDI_REGEX = re.compile(f'[{BIDI_CHARS}]')


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

    # Prefer '_chat.txt' (standard for iOS exports)
    for f in txt_files:
        if f.name.lower() == '_chat.txt':
            return f
    # Prefer files with 'chat' or 'whatsapp' in name
    for f in txt_files:
        if 'chat' in f.name.lower() or 'whatsapp' in f.name.lower():
            return f
    return txt_files[0]


def parse_chat(chat_file):
    """Parse WhatsApp chat export file (supports iOS, Android, multilingual formats)"""
    # iOS bracket pattern: [Date, Time] Sender: Message or [Date, Time] System Message
    ios_pattern = re.compile(
        r'^\[([0-9]{1,4}[/.-][0-9]{1,2}[/.-][0-9]{1,4})[,\s،]+([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?(?:\s*(?:[apAP]\.?[mM]\.?|[صم]))?)\]\s*(.*)$'
    )
    # Android dash pattern: Date, Time - Sender: Message or Date, Time - System Message
    android_pattern = re.compile(
        r'^([0-9]{1,4}[/.-][0-9]{1,2}[/.-][0-9]{1,4})[,\s،]+([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?(?:\s*(?:[apAP]\.?[mM]\.?|[صم]))?)\s*-\s*(.*)$'
    )

    messages = []
    current_message = None

    with open(chat_file, 'r', encoding='utf-8') as f:
        for line in f:
            raw_line = line.rstrip('\r\n')
            clean_line = BIDI_REGEX.sub('', raw_line).strip()

            # Match new message line
            match = ios_pattern.match(clean_line) or android_pattern.match(clean_line)
            if match:
                if current_message:
                    messages.append(current_message)

                date_str, time_str, rest = match.groups()

                # Check if this is an end-to-end encryption notification
                is_encryption = any(
                    phrase in rest for phrase in [
                        'الرسائل والمكالمات مشفرة',
                        'end-to-end encrypted',
                        'chiffrés de bout en bout',
                        'verschlüsselt'
                    ]
                )

                colon_idx = rest.find(':')
                if is_encryption:
                    current_message = {
                        'date': date_str,
                        'time': time_str,
                        'sender': None,
                        'text': rest[colon_idx + 1:].strip() if colon_idx != -1 else rest.strip(),
                        'type': 'system'
                    }
                elif colon_idx != -1:
                    sender = rest[:colon_idx].strip()
                    text = rest[colon_idx + 1:].strip()
                    current_message = {
                        'date': date_str,
                        'time': time_str,
                        'sender': sender,
                        'text': text,
                        'type': 'message'
                    }
                else:
                    current_message = {
                        'date': date_str,
                        'time': time_str,
                        'sender': None,
                        'text': rest.strip(),
                        'type': 'system'
                    }
                continue

            # Continuation of previous message (multi-line)
            if current_message and raw_line:
                current_message['text'] += '\n' + raw_line

    if current_message:
        messages.append(current_message)

    return messages


def detect_media(text, folder):
    """Detect media files referenced in message (iOS, Android, Arabic, English, etc.)"""
    media_info = {
        'has_media': False,
        'media_type': None,
        'filename': None,
        'filepath': None,
        'clean_text': text
    }

    # Match iOS format: <المُرفق: filename> or <attached: filename> or generic <tag: filename>
    ios_match = re.search(r'<[^:>]+:\s*([^>]+)>', text)
    # Match Android format: filename (file attached) or filename (ملف مرفق)
    android_match = re.search(r'(.+?)\s*\((?:file attached|ملف مرفق)\)', text, re.IGNORECASE)

    filename = None
    if ios_match:
        candidate = ios_match.group(1).strip(f' {BIDI_CHARS}\xa0')
        filepath = folder / candidate
        if filepath.exists():
            filename = candidate
            media_info['clean_text'] = re.sub(r'<[^:>]+:\s*[^>]+>', '', text).strip(f' {BIDI_CHARS}\xa0')
    elif android_match:
        candidate = android_match.group(1).strip(f' {BIDI_CHARS}\xa0')
        filepath = folder / candidate
        if filepath.exists():
            filename = candidate
            media_info['clean_text'] = re.sub(
                r'.+?\s*\((?:file attached|ملف مرفق)\)', '', text, flags=re.IGNORECASE
            ).strip(f' {BIDI_CHARS}\xa0')

    if filename:
        media_info['has_media'] = True
        media_info['filename'] = filename
        media_info['filepath'] = folder / filename

        ext = media_info['filepath'].suffix.lower()
        if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            media_info['media_type'] = 'image'
        elif ext in ['.mp4', '.mov', '.avi', '.mkv', '.3gp']:
            media_info['media_type'] = 'video'
        elif ext in ['.mp3', '.ogg', '.opus', '.wav', '.m4a', '.aac']:
            media_info['media_type'] = 'audio'
        elif ext in ['.pdf']:
            media_info['media_type'] = 'pdf'
        elif ext in ['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.txt', '.csv', '.zip']:
            media_info['media_type'] = 'document'
        else:
            media_info['media_type'] = 'file'

    # Check for omitted media
    omitted_phrases = [
        '<Media omitted>',
        '<ملف وسائط تم حذفه>',
        'لم يتم إدراج الصورة',
        'لم يتم إدراج الفيديوهات',
        'لم يتم إدراج ملف صوتي',
        'لم يتم إدراج المستند',
        '<تم استبعاد الوسائط>'
    ]
    for phrase in omitted_phrases:
        if phrase in text:
            media_info['has_media'] = True
            media_info['media_type'] = 'omitted'
            media_info['clean_text'] = text.replace(phrase, '').strip(f' {BIDI_CHARS}\xa0')
            break

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
            <img src="{src}" alt="{escape(filename)}" onclick="openMedia(this.src, 'image')" loading="lazy">
        </div>'''

    elif media_type == 'video':
        return f'''<div class="media-container">
            <div class="video-thumbnail" onclick="openMedia('{encoded_filename}', 'video')">
                <video src="{encoded_filename}" preload="metadata"></video>
            </div>
        </div>'''

    elif media_type == 'audio':
        return f'''<div class="media-container">
            <audio controls preload="metadata">
                <source src="{encoded_filename}" type="audio/ogg; codecs=opus">
                <source src="{encoded_filename}" type="audio/ogg">
                <source src="{encoded_filename}">
                Your browser does not support audio playback.
            </audio>
        </div>'''

    elif media_type in ['pdf', 'document', 'file']:
        size = get_file_size(filepath)
        ext = filepath.suffix.lower().replace('.', '') or 'file'
        icon_class = 'pdf' if ext == 'pdf' else 'doc' if ext in ['doc', 'docx'] else 'xls' if ext in ['xls', 'xlsx'] else 'ppt' if ext in ['ppt', 'pptx'] else 'file'
        return f'''<a href="{encoded_filename}" target="_blank" class="document-link">
            <div class="document-icon {icon_class}">{ext.upper()[:4]}</div>
            <div class="document-info">
                <div class="document-name" dir="auto">{escape(filename)}</div>
                <div class="document-size">{size}</div>
            </div>
        </a>'''

    return ''


def detect_date_order(messages):
    """Detect whether dates in messages are month_first (M/D/Y) or day_first (D/M/Y)"""
    has_day_first = False
    has_month_first = False
    for msg in messages:
        d = msg.get('date', '')
        clean = BIDI_REGEX.sub('', d).strip()
        parts = re.split(r'[/.-]', clean)
        if len(parts) == 3:
            try:
                p1, p2 = int(parts[0]), int(parts[1])
                if p1 > 12:
                    has_day_first = True
                if p2 > 12:
                    has_month_first = True
            except ValueError:
                pass
    if has_month_first and not has_day_first:
        return 'month_first'
    return 'day_first'


def format_chat_date(date_str, date_order='day_first'):
    """Format date string to a readable format (e.g. 'February 11, 2025')"""
    clean_date = BIDI_REGEX.sub('', date_str).strip()
    norm = re.sub(r'[/.-]', '/', clean_date)
    parts = norm.split('/')
    if len(parts) == 3:
        y_fmt = '%Y' if len(parts[2]) == 4 else '%y'
        if date_order == 'month_first':
            formats = [f'%m/%d/{y_fmt}', f'%d/%m/{y_fmt}']
        else:
            formats = [f'%d/%m/{y_fmt}', f'%m/%d/{y_fmt}']

        for fmt in formats:
            try:
                dt = datetime.strptime(norm, fmt)
                return dt.strftime('%B %d, %Y')
            except ValueError:
                pass
    return date_str


def format_time_display(time_str):
    """Clean time string: remove seconds and non-breaking spaces for display"""
    clean_time = time_str.replace('\xa0', ' ').strip(f' {BIDI_CHARS}')
    # Remove seconds if present: 2:22:13 PM -> 2:22 PM, 2:22:13 م -> 2:22 م
    m = re.match(r'^(\d{1,2}:\d{2}):\d{2}(\s*.*)$', clean_time)
    if m:
        return f"{m.group(1)}{m.group(2)}"
    return clean_time


def generate_html(messages, folder, you_name=None, embed_images=False):
    """Generate HTML from parsed messages"""
    folder = Path(folder)

    # Detect "you" sender if not specified
    senders = {}
    for msg in messages:
        if msg['sender'] and msg['type'] == 'message':
            senders[msg['sender']] = senders.get(msg['sender'], 0) + 1

    if you_name is None:
        # Check if the folder name contains one of the senders (e.g. "WhatsApp Chat - <Contact Name>")
        folder_str = folder.name
        matched_other = None
        for sender in senders:
            if sender in folder_str:
                matched_other = sender
                break

        if matched_other and len(senders) == 2:
            # The contact in the folder name is the other person; the other sender is 'you'
            other_candidates = [s for s in senders if s != matched_other]
            you_name = other_candidates[0]
        elif senders:
            # Fallback to the least frequent sender
            you_name = min(senders, key=senders.get)

    # Get chat name (the other person)
    other_name = None
    for msg in messages:
        if msg['sender'] and msg['sender'] != you_name:
            other_name = msg['sender']
            break

    chat_name = other_name or "WhatsApp Chat"
    date_order = detect_date_order(messages)

    html_messages = []
    current_date = None

    for msg in messages:
        # Date separator
        if msg['date'] != current_date:
            current_date = msg['date']
            formatted_date = format_chat_date(msg['date'], date_order)
            html_messages.append(f'''<div class="date-separator">
                <span>{formatted_date}</span>
            </div>''')

        # System message
        if msg['type'] == 'system':
            html_messages.append(f'''<div class="system-message">
                <span dir="auto">{escape(msg['text'])}</span>
            </div>''')
            continue

        # Regular message
        is_sent = msg['sender'] == you_name
        direction = 'sent' if is_sent else 'received'

        # Check for media
        media_info = detect_media(msg['text'], folder)

        # Check for deleted message
        deleted_phrases = [
            'This message was deleted',
            'You deleted this message',
            'تم حذف هذه الرسالة',
            'حذف هذه الرسالة',
            'لقد حذفت هذه الرسالة'
        ]
        is_deleted = any(phrase in msg['text'] for phrase in deleted_phrases)

        # Check for call notices
        call_phrases = [
            'مكالمة صوتية',
            'مكالمة فيديو',
            'Missed voice call',
            'Missed video call',
            'Voice call',
            'Video call'
        ]
        is_call = any(phrase in msg['text'] for phrase in call_phrases)

        # Build message content
        content_parts = []

        # Sender name (only for received messages in group-like view)
        if not is_sent and msg['sender']:
            content_parts.append(f'<div class="sender-name" dir="auto">{escape(msg["sender"])}</div>')

        # Media
        if media_info['has_media']:
            content_parts.append(render_media(media_info, embed_images))

        # Text content
        text = media_info['clean_text']
        if text:
            if is_deleted:
                content_parts.append(f'<div class="message-text deleted-message" dir="auto">🚫 {escape(text)}</div>')
            elif is_call:
                icon = '📹' if any(k in text for k in ['فيديو', 'video', 'Video']) else '📞'
                content_parts.append(f'<div class="message-text" dir="auto">{icon} {escape(text)}</div>')
            else:
                content_parts.append(f'<div class="message-text" dir="auto">{format_message_text(text)}</div>')

        # Time
        formatted_time = format_time_display(msg["time"])
        content_parts.append(f'<div class="message-time">{formatted_time}</div>')

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
