# commands

## Overview
CLI command handlers for `@whatsappya/cli`. Implements the `convert` command by wiring `@whatsappya/core`'s `ConvertChat` use case and `ParserRegistry` with `@whatsappya/platform-node`'s directory file source.

## Interface
- `[convert.ts:ConvertOptions]` — `export interface ConvertOptions` with `readonly` fields `input: string`, `output: string`, and `you: string | undefined`.
- `[convert.ts:convertCommand]` — `export async function convertCommand(opts: ConvertOptions): Promise<number>` returning an exit status code.

## Invariants
- `[convert.ts:ConvertOptions]` — All option fields (`input`, `output`, `you`) are declared `readonly`.
- `[convert.ts:convertCommand]` — Registers `IosParser` then `AndroidParser` from `@whatsappya/core` into `ParserRegistry` with `stages: []`.
- `[convert.ts:convertCommand]` — Forwards `ownerName: opts.you` to `ConvertChat.execute` only when `opts.you` is truthy.
- `[convert.ts:convertCommand]` — Returns `1` when `!result.ok` and `0` when `result.ok` (exporter wiring is marked `TODO`; `opts.output` is currently only logged).

## Side Effects
- `[convert.ts:convertCommand]` — Instantiates `DirectoryFileSource(opts.input)` (`@whatsappya/platform-node`) and executes `ConvertChat.execute` (`@whatsappya/core`).
- `[convert.ts:convertCommand]` — Writes `✗ ${result.error.code}` to `console.error` on failure, and `✓ Parsed ${result.value.messages.length} messages → ${opts.output} (exporter wiring TODO)` to `console.log` on success.

## Verification
- Run: `pnpm test`
