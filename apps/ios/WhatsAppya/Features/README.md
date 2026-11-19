# Features

## Overview
Feature-sliced SwiftUI modules for the `WhatsAppya` iOS application, covering chat export import, timeline playback/viewing, and shareable statistics rendering.

## Subdirectories & Boundaries
- `ChatViewer`: [./ChatViewer/README.md](./ChatViewer/README.md) - SwiftUI `LazyVStack`/`List` chat viewer, voice note playback (`AVFoundation`), and sticker rendering.
- `Import`: [./Import/README.md](./Import/README.md) - Import entry screen (`ImportView`) for chats from Files, drag-and-drop, or Share Extension App Group zips.
- `Stats`: [./Stats/README.md](./Stats/README.md) - "Chat Wrapped" summary card rendered with `ImageRenderer` for sharing.
