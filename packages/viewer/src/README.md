# Viewer Source

## Overview
Root source entrypoint for `@whatsappya/viewer`, defining the registry list of framework-free Web Components (`VIEWER_ELEMENTS`) alongside component and style documentation boundaries.

## Interface
- `[index.ts:VIEWER_ELEMENTS]`: Exported `as const` readonly tuple of custom element tag names: `"wa-message-list"`, `"wa-voice-note"`, `"wa-sticker"`, `"wa-lightbox"`, `"wa-search"`, `"wa-split-view"`, `"wa-breadcrumbs"`.
- `./components`: [Components](./components/README.md) — Custom element specs for virtualized message list, voice notes, stickers, lightbox, search, and curricular navigation (`./components/navigation/README.md`).
- `./styles`: [Styles](./styles/README.md) — Design token CSS consumption (`tokens.css`) and reduced-motion styling rules.

## Invariants
- None.

## Side Effects
- None.

## Verification
- Run: `pnpm test`
