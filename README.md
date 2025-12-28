# BeautifyWhatsAppExport

Transform your exported WhatsApp chats into beautiful, interactive HTML pages with an authentic WhatsApp UI.

## Features

- **Authentic WhatsApp Design** - Pixel-perfect recreation of WhatsApp's interface with proper message bubbles, tails, colors, and typography
- **Media Support** - Display images, videos, audio files, and documents inline
- **Fully Responsive** - Optimized layouts for desktop, tablet, and mobile devices
- **Interactive Media Viewer** - Click images and videos to view fullscreen with keyboard navigation
- **Automatic Link Detection** - URLs in messages are automatically converted to clickable links
- **Message Direction** - Correctly identifies sent vs received messages with proper styling
- **System Messages** - Handles WhatsApp system notifications (member joined, left, etc.)
- **Date Separators** - Organized by date with clean visual separators
- **Self-Contained HTML** - Generated files work standalone without external dependencies
- **Easy Customization** - Separate CSS and JavaScript files for easy styling modifications

## Installation

### Requirements
- Python 3.7 or higher

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/BeautifyWhatsAppExport.git
cd BeautifyWhatsAppExport
```

2. No additional dependencies required - uses only Python standard library!

## Usage

### Basic Usage

Export your WhatsApp chat (with media) and run:

```bash
python main.py "path/to/chat/folder"
```

This will generate `chat.html` in the same folder as your chat export.

### Command-Line Options

```bash
python main.py <chat_folder> [OPTIONS]
```

**Options:**

- `--output`, `-o` : Specify output HTML filename (default: `chat.html`)
- `--you`, `-y` : Your name to display messages on the right side
- `--embed-images`, `-e` : Embed images as base64 (makes HTML larger but fully portable)

### Examples

**1. Generate with custom output name:**
```bash
python main.py "./WhatsApp Chat" --output my_conversation.html
```

**2. Specify your name for correct message alignment:**
```bash
python main.py "./WhatsApp Chat" --you "John" --output john_sarah.html
```

**3. Create fully portable HTML with embedded images:**
```bash
python main.py "./WhatsApp Chat" --embed-images
```

**4. All options combined:**
```bash
python main.py "./WhatsApp Chat" -y "John" -o conversation.html -e
```

## How to Export WhatsApp Chat

1. Open WhatsApp on your phone
2. Go to the chat you want to export
3. Tap the three dots (menu) → **More** → **Export chat**
4. Choose **Include Media** (or **Without Media** if you prefer)
5. Save the exported folder to your computer
6. Run this tool on that folder

## Project Structure

```
BeautifyWhatsAppExport/
├── main.py           # Main Python script
├── template.html     # HTML template structure
├── style.css         # WhatsApp-style CSS
├── script.js         # Interactive JavaScript
└── README.md         # This file
```

## How It Works

1. **Parsing** - Reads the exported `.txt` file and identifies messages using regex patterns
2. **Media Detection** - Finds and links media files (images, videos, audio, documents)
3. **HTML Generation** - Creates HTML with authentic WhatsApp styling
4. **CSS/JS Inlining** - Embeds external CSS and JavaScript into the final HTML for portability
5. **Output** - Generates a single, self-contained HTML file

## Features in Detail

### Message Types Supported
- Regular text messages
- Messages with media (images, videos, audio)
- Document attachments (PDF, Word, Excel, PowerPoint)
- Deleted messages
- System notifications
- Multi-line messages

### Media Handling
- **Images**: Display inline with lightbox viewer
- **Videos**: Thumbnail with play button, fullscreen playback
- **Audio**: Native HTML5 audio player
- **Documents**: Download links with file type icons and size

### Responsive Design
- **Desktop**: Wide layout with comfortable message bubbles (max 65% width)
- **Tablet**: Adjusted padding and bubble sizing (75% width)
- **Mobile**: Optimized for small screens (80-85% width)

## Customization

Want to modify the appearance? Edit these files:

- `style.css` - All styling (colors, fonts, spacing, animations)
- `script.js` - Interactive features (modal viewer, keyboard shortcuts)
- `template.html` - HTML structure

After editing, just run the script again to generate updated HTML.

## Tips

1. **Keep media files** - Make sure media files stay in the same folder as the generated HTML
2. **Use embed-images for sharing** - If you want to share the HTML, use `--embed-images` flag
3. **Specify your name** - Use `--you` flag for better message alignment (your messages on right)
4. **Browser compatibility** - Works in all modern browsers (Chrome, Firefox, Safari, Edge)

## Known Limitations

- Requires the original WhatsApp export format
- Media files must be in the same directory (unless using `--embed-images`)
- Stickers and GIFs are treated as regular images
- Voice notes appear as audio files (not the WhatsApp waveform UI)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.


## Acknowledgments

- Inspired by WhatsApp's beautiful messaging interface
- Built with vanilla HTML, CSS, and JavaScript - no frameworks needed!

---

**Star this repo if you found it useful!** ⭐
