# Exporter Source

## Overview
Core source module of `@whatsappya/exporter`, building self-contained, offline single-file HTML archives (`StandaloneHtmlExporter`) from a `ChatSession` and bundled viewer assets.

## Interface
- `[index.ts:ExportAssets]`: Re-exported from `./StandaloneHtmlExporter.js`.
- `[index.ts:StandaloneHtmlExporter]`: Re-exported from `./StandaloneHtmlExporter.js`.
- `[StandaloneHtmlExporter.ts:ExportAssets]`: Exported interface with `readonly viewerJs: string` and `readonly viewerCss: string`.
- `[StandaloneHtmlExporter.ts:StandaloneHtmlExporter]`: Exported class with `constructor(assets: ExportAssets)`.
- `[StandaloneHtmlExporter.ts:StandaloneHtmlExporter.build]`: `build(session: ChatSession): string` — returns a standalone HTML document embedding the serialized session and viewer assets.

## Invariants
- `[StandaloneHtmlExporter.ts:ExportAssets]`: `viewerJs` and `viewerCss` fields are `readonly`.
- `[StandaloneHtmlExporter.ts:StandaloneHtmlExporter.constructor]`: Stores `assets` as `private readonly`.
- `[StandaloneHtmlExporter.ts:StandaloneHtmlExporter.build]`: Escapes `<` as `\u003c` in `JSON.stringify(session)` before embedding in `<script type="application/json" id="chat-data">`.
- `[StandaloneHtmlExporter.ts:StandaloneHtmlExporter.build]`: Escapes `&`, `<`, `>`, `"`, and `'` in `session.title` via `escapeHtml` before interpolating into `<title>`.
- `[StandaloneHtmlExporter.ts:StandaloneHtmlExporter.build]`: Embeds session JSON in `<script type="application/json" id="chat-data">` alongside `<wa-message-list></wa-message-list>`, inline `<style>`, and `<script type="module">` rather than pre-rendering message DOM.

## Side Effects
- None.

## Verification
- Run: `pnpm test`
