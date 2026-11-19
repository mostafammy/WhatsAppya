# `@whatsappya/design-tokens`

## Overview
Single source of truth for colour, typography, spacing, and motion tokens in the monorepo, compiling JSON token sources into CSS custom properties (`dist/tokens.css`) and Swift constants (`dist/Tokens.swift`).

## Subdirectories & Boundaries
- `scripts`: [Design Tokens Build Script](./scripts/README.md) — Executable ESM generator (`build.mjs`) that reads `tokens/color.json` and emits CSS `--wa-*` custom properties and Swift `WATokens` constants.
