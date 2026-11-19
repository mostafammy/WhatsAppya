# Packages

## Overview
Monorepo workspace packages implementing the platform-agnostic chat domain and conversion engine, cross-platform design tokens, standalone HTML exporter, Node and browser platform adapters, and Web Components viewer.

## Subdirectories & Boundaries
- `core`: [`@whatsappya/core`](./core/README.md) — Pure, platform-agnostic domain models, four-tier curriculum hierarchy types, parser registry/stubs, sequential pipeline runner, hexagonal ports, search contracts, `Result` helpers, and `ConvertChat` use case.
- `design-tokens`: [`@whatsappya/design-tokens`](./design-tokens/README.md) — Single source of truth for colour and motion tokens, compiling `tokens/color.json` into CSS custom properties (`dist/tokens.css`) and Swift constants (`dist/Tokens.swift`).
- `exporter`: [`@whatsappya/exporter`](./exporter/README.md) — Builds self-contained, offline single-file HTML archives (`StandaloneHtmlExporter`) from a `ChatSession` and viewer assets.
- `platform-node`: [`@whatsappya/platform-node`](./platform-node/README.md) — Node.js filesystem adapter (`DirectoryFileSource`) implementing `@whatsappya/core` ports over local directories.
- `platform-web`: [`@whatsappya/platform-web`](./platform-web/README.md) — Browser `.zip` adapter (`ZipFileSource` via `fflate`) and planned Web Share Target and OPFS storage adapters.
- `viewer`: [`@whatsappya/viewer`](./viewer/README.md) — Framework-free Web Components chat viewer defining `VIEWER_ELEMENTS` registrations, custom element specs, and design-token stylesheet integration.
