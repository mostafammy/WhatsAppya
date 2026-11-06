#  WhatsAppya

> **WhatsAppya** transforms exported WhatsApp chats into Apple-grade interactive HTML viewers with multi-tier curricular support (Multiple Blocks, Multiple Subjects per Block, Multiple Chapters per Subject).

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python Version](https://img.shields.io/badge/python-3.10%2B-brightgreen.svg)](https://python.org)
[![Code Architecture](https://img.shields.io/badge/architecture-SOLID%20%7C%20GoF-orange.svg)]()
[![Design System](https://img.shields.io/badge/design-Apple%20HIG%20%7C%20Cupertino-black.svg)]()

---

## ✨ Features

- ** Apple Human Interface Guidelines (HIG)** - Native SF Pro typography, Cupertino dynamic vibrancy (`backdrop-filter`), and seamless Dark Mode.
- **📚 Multi-Tier Curricular Navigation** - Organizes chats, voice lectures, and study groups across **Multiple Blocks › Multiple Subjects › Multiple Chapters**.
- **🎙 Bespoke Voice Note Canvas Player** - Interactive synthetic audio waveforms, drag scrubbing, and variable playback speed (1.0× / 1.5× / 2.0×).
- **🔍 Universal Spotlight Search (⌘K / ⌘F)** - Inverted index enabling sub-20ms instant full-text search across all chapters, messages, and voice notes.
- **🖼 Inline Media Studio** - Full inline support for images, videos, audio notes, and PDFs with interactive fullscreen lightbox.
- **🔒 100% On-Device Privacy** - Zero cloud egress, zero external CDN dependencies, and zero telemetry. Everything runs locally from a `file://` URI.
- **🌍 BiDi & Multilingual Harmony** - Flawless bidirectional rendering for Arabic and English conversations with strict punctuation isolation.

---

## 🚀 Quick Start

### Requirements
- Python 3.10 or higher
- Any modern web browser (Safari, Chrome, Edge, Firefox)

### Installation

Clone the repository:
```bash
git clone https://github.com/mostafammy/WhatsAppya.git
cd WhatsAppya
```

*Zero external dependencies required — runs 100% on Python standard library!*

---

## 📖 Usage

### 1. Single Chat Archival Mode

Point **WhatsAppya** to any unzipped WhatsApp export directory containing `_chat.txt` and its media:

```bash
python3 main.py "path/to/WhatsApp Chat Export"
```

This generates a standalone, interactive `chat.html` inside the export folder.

### 2. Multi-Tier Curricular Mode (Blocks › Subjects › Chapters)

Point **WhatsAppya** to a directory structured with curricular folders:

```
Curriculum/
├── Block 1 - Cardiovascular/
│   ├── Anatomy/
│   │   ├── Chapter 1 - Heart Chambers/ (_chat.txt + media)
│   │   └── Chapter 2 - Valves/ (_chat.txt + media)
│   └── Physiology/
│       └── Chapter 1 - Cardiac Cycle/ (_chat.txt + media)
└── Block 2 - Respiratory/
    └── Pulmonology/
        └── Chapter 1 - Gas Exchange/ (_chat.txt + media)
```

Run WhatsAppya in curricular mode:
```bash
python3 main.py "path/to/Curriculum" --output "dist/CurriculumViewer.html"
```

---

## 🏛 Architecture & Engineering Standards

- **[SPECIFICATION.md](SPECIFICATION.md)**: Apple Engineering Specification (`SPEC-APPL-ACAD-2026-V2`) covering the Composite Tree architecture, SOLID realization matrix, and Cupertino Executive Board review.
- **[Plan.md](Plan.md)**: Detailed phased engineering roadmap (`PLAN-APPL-ACAD-2026-V2`) with implementable tasks and QA test protocols.

---

## 📄 License

MIT License. Crafted with Apple-grade precision.
