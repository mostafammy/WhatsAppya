# Android Chat Parser

## Overview
Android WhatsApp `.txt` export parser implementation of `ChatParser` within `@whatsappya/core`. Detects Android chat line formats and defines the parser entrypoint for extracting `RawMessage` records.

## Interface
- `[AndroidParser.ts:AndroidParser]`: Exported class implementing `ChatParser`.
- `[AndroidParser.ts:AndroidParser.id]`: `readonly id = "android"`.
- `[AndroidParser.ts:AndroidParser.canHandle]`: `canHandle(sampleLines: readonly string[]): boolean` — detects Android-formatted WhatsApp export lines.
- `[AndroidParser.ts:AndroidParser.parse]`: `parse(_text: string): readonly RawMessage[]` — converts raw Android export text into `RawMessage` records.

## Invariants
- `[AndroidParser.ts:AndroidParser.id]`: Parser identifier is `readonly` and fixed to `"android"`.
- `[AndroidParser.ts:AndroidParser.canHandle]`: Returns `true` if and only if at least one line in `sampleLines` matches `AndroidParser.#LINE` (`/^(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}),?\s+([\d:]+(?:\s?[APap]\.?[Mm]\.?)?)\s+-\s/`).
- `[AndroidParser.ts:AndroidParser.parse]`: Currently an unimplemented port stub that unconditionally throws `Error("TODO(port): converter/parsers/android.py — validate against fixtures/golden")`.

## Side Effects
- None.

## Verification
- Run: `pnpm test`
