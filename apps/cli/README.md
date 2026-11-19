# cli

## Overview
Power-user Node.js CLI application (`@whatsappya/cli`, binary `whatsappya`) sharing the TypeScript `@whatsappya/core` conversion pipeline and `@whatsappya/platform-node` adapters (`package.json`, `tsconfig.json`).

## Subdirectories & Boundaries
- `src`: [./src/README.md](./src/README.md) - CLI process entrypoint (`index.ts`) parsing `<export-folder>`, `-o`/`--output`, and `-y`/`--you` flags and dispatching to the `commands` module.
