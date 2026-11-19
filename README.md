# WhatsAppya

> **WhatsAppya** is a private, 100% on-device WhatsApp chat export viewer, archive reader, and offline HTML exporter for Web/PWA, CLI, Android TWA, and native iOS (Swift).

[![Architecture](https://img.shields.io/badge/architecture-Hexagonal%20%7C%20SOLID-orange.svg)](docs/ARCHITECTURE.md)
[![Design](https://img.shields.io/badge/design-Apple%20HIG%20%7C%20Cupertino-black.svg)](docs/designs/whatsappya-3-phase-architecture.md)

---

## Key Capabilities

- **Zero-Copy ZIP Ingestion** — Reads the ZIP Central Directory via tail-slicing and loads attachments lazily on demand (`ZipFileSource.sliceBlob()`), avoiding full-archive memory copies.
- **Virtualized 50k+ Message Viewer (`<wa-message-list>`)** — Framework-free Web Components powered by a Fenwick tree (`O(log N)` offsets), typed DOM node pooling, and single-`rAF` `ResizeObserver` batching.
- **Two-Tier Hybrid Spotlight Search (`⌘K` / `Ctrl+K`)** — Off-main-thread Web Worker running compact `Uint32Array` posting lists + Arabic normalization (tashkeel, alef variants, teh marbuta, alef maksura) with a normalized linear scan fallback for URLs and punctuation.
- **Adaptive Curricular Navigation (`<wa-split-view>`, `<wa-breadcrumbs>`)** — Hides the sidebar automatically for single-chat exports (`sessionCount <= 1`) and presents a collapsible tree for multi-chapter archives (`Blocks › Subjects › Chapters`).
- **Self-Contained Offline HTML Exports** — Bundles the complete `<wa-message-list>`, `<wa-voice-note>`, `<wa-sticker>`, `<wa-lightbox>`, `<wa-search>`, and `HybridSearchIndex` runtime into a `file://`-safe IIFE (`--standalone` or folder bundle with opt-in `--legacy-voice-cache`).
- **100% On-Device Privacy** — Strict `connect-src 'none'` CSP, offline Service Worker app-shell cache, and Android Web Share Target (`POST /share-target`) with zero cloud egress.
- **Cross-Language Parity (TypeScript + Swift)** — Shared JSON Schema contracts (`contracts/`) and golden fixtures (`fixtures/golden/`) verified across both `@whatsappya/core` and native Swift `WhatsAppyaCore`.

---

## Quick Start

### Prerequisites
- **Node.js 22+** and **pnpm 12+**
- **Swift 5.10+ / 6.x** (optional, for native iOS package verification)

### Install & Run CI

```bash
pnpm install
pnpm run ci
```

### 1. Web PWA (Drag-and-Drop / Android Share Target)

```bash
pnpm dev
# Production build:
pnpm --filter @whatsappya/web build
```

Drop any `.zip` export or `_chat.txt` file directly onto the page. Press `⌘K` (or `Ctrl+K`) to search, click images/videos for QuickLook preview, or click **Export Offline HTML**.

### 2. CLI (`whatsappya`)

```bash
pnpm --filter @whatsappya/cli build
node apps/cli/dist/index.js "path/to/WhatsApp Chat Export" --dist out/
```

Useful flags:
- `-o, --output <name>` — Output HTML filename (default: `chat.html`)
- `-y, --you <name>` — Explicit sender name for sent (right-aligned) bubbles
- `-d, --dist <dir>` — Output directory (copies media assets and generates outer launcher + `index.html`)
- `--standalone` — Emit a single self-contained HTML file
- `--legacy-voice-cache` — Opt-in generation of `_voice_cache/*.js` for `file://` audio fallback

### 3. Native iOS (`WhatsAppyaKit`)

Verify native Swift golden-file parity against the shared JSON fixtures:

```bash
cd apps/ios/Packages/WhatsAppyaKit
swift run WhatsAppyaGoldenVerifier
```

Generate the Xcode project via XcodeGen (`apps/ios/project.yml`):

```bash
cd apps/ios && xcodegen generate
```

---

## Workspace Layout

- **[contracts/](contracts/)** — Canonical cross-language schemas (`chat-session.schema.json`, `archive-tree.schema.json`, `parser-rules.json`).
- **[packages/core](packages/core/)** (`@whatsappya/core`) — Pure zero-dependency domain models, iOS/Android parsers, pipeline stages, `ConvertChat`, `ConvertArchive`, and `HybridSearchIndex`.
- **[packages/viewer](packages/viewer/)** (`@whatsappya/viewer`) — Framework-free Custom Elements (`<wa-message-list>`, `<wa-voice-note>`, `<wa-sticker>`, `<wa-lightbox>`, `<wa-search>`, `<wa-split-view>`, `<wa-breadcrumbs>`) + self-contained offline bundle (`@whatsappya/viewer/standalone`).
- **[packages/exporter](packages/exporter/)** (`@whatsappya/exporter`) — `StandaloneHtmlExporter` and `FolderBundleExporter`.
- **[packages/platform-web](packages/platform-web/)** & **[packages/platform-node](packages/platform-node/)** — Zero-copy `ZipFileSource` and `DirectoryFileSource` adapters.
- **[packages/design-tokens](packages/design-tokens/)** — Single-source Cupertino color and motion tokens emitting CSS and Swift.
- **[apps/web](apps/web/)** — Vite PWA with Service Worker, Web Share Target, and Web Worker search.
- **[apps/cli](apps/cli/)** — Node.js CLI (`whatsappya`).
- **[apps/ios](apps/ios/)** — Native SwiftUI app, Share Extension, and `WhatsAppyaKit` Swift Package.
- **[apps/android-twa](apps/android-twa/)** — Bubblewrap Trusted Web Activity wrapper.
- **[fixtures/](fixtures/)** — Synthetic exports and golden JSON snapshots verified by both TS and Swift.
- **[legacy/python/](legacy/python/)** — Archived reference Python 3.10+ implementation (`PYTHONPATH=legacy/python python3 -m unittest discover legacy/python/tests`).

---

## Architecture & Design Docs

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Hexagonal architecture, dependency rule, and design patterns.
- **[docs/designs/whatsappya-3-phase-architecture.md](docs/designs/whatsappya-3-phase-architecture.md)** — Full 3-phase architecture RFC and performance gates.
