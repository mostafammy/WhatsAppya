# src

## Overview
Entrypoint and command modules for the `@whatsappya/cli` Node.js binary (`whatsappya`). Parses CLI arguments via `node:util` `parseArgs` and dispatches conversion execution to the `commands` module.

## Interface
- `[index.ts:positionals]` — Positional argument `<export-folder>` (`input`) parsed with `allowPositionals: true` (`index.ts` exports no JS/TS module symbols).
- `[index.ts:--output]` — Optional string CLI flag (`-o`) forwarded as `output` to `convertCommand` (defaults to `"chat.html"`).
- `[index.ts:--you]` — Optional string CLI flag (`-y`) forwarded as `you` to `convertCommand`.
- [./commands/README.md](./commands/README.md) — CLI command handlers (`[convert.ts:ConvertOptions]`, `[convert.ts:convertCommand]`).

## Invariants
- `[index.ts:input]` — Requires a truthy first positional argument `input`; otherwise logs CLI usage to `stderr` and exits with code `64`.
- `[index.ts:values.output]` — Falls back to `"chat.html"` when `values.output` is nullish (`values.output ?? "chat.html"`).

## Side Effects
- `[index.ts:parseArgs]` — Reads and parses process CLI arguments via `node:util` `parseArgs` at module top level.
- `[index.ts:console.error]` — Writes `'Usage: whatsappya <export-folder> [-o chat.html] [-y "Your Name"]'` to `stderr` when `input` is missing.
- `[index.ts:convertCommand]` — Executes `await convertCommand({ input, output: values.output ?? "chat.html", you: values.you })` at module top level.
- `[index.ts:process.exit]` — Terminates the Node.js process with exit code `64` on missing `input`, or with the exit code returned by `convertCommand`.

## Verification
- Run: `pnpm test`
