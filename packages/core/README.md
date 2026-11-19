# `@whatsappya/core`

## Overview
Pure, platform-agnostic domain and WhatsApp chat parsing engine (`@whatsappya/core`) with zero runtime dependencies and no DOM or Node.js APIs.

## Subdirectories & Boundaries
- `src`: [Core Source](./src/README.md) — Barrel export (`index.ts`) re-exporting domain models and hierarchy types (`./src/domain/README.md`), application orchestration (`./src/application/README.md`), parser strategy and registry (`./src/parsers/README.md`), enrichment pipeline runner (`./src/pipeline/README.md`), hexagonal ports (`./src/ports/README.md`), search contracts (`./src/search/README.md`), and `Result` helpers (`./src/shared/README.md`).
