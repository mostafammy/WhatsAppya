# iOS Chat Parser

## Overview
iOS WhatsApp `.txt` export parser implementation of `ChatParser` within `@whatsappya/core`. Detects iOS bracketed chat line formats and defines the parser entrypoint for extracting `RawMessage` records.

## Interface
- `[IosParser.ts:IosParser]`: Exported class implementing `ChatParser`.
- `[IosParser.ts:IosParser.id]`: `readonly id = "ios"`.
- `[IosParser.ts:IosParser.canHandle]`: `canHandle(sampleLines: readonly string[]): boolean` — detects iOS-formatted WhatsApp export lines.
- `[IosParser.ts:IosParser.parse]`: `parse(_text: string): readonly RawMessage[]` — converts raw iOS export text into `RawMessage` records.

## Invariants
- `[IosParser.ts:IosParser.id]`: Parser identifier is `readonly` and fixed to `"ios"`.
- `[IosParser.ts:IosParser.canHandle]`: Returns `true` if and only if at least one entry in `sampleLines` matches `IosParser.#LINE` (`/^\u200e?\[(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}),?\s+([\d:]+(?:\s?[APap]\.?[Mm]\.?)?)\]\s/`).
- `[IosParser.ts:IosParser.parse]`: Currently an unimplemented port stub that unconditionally throws `Error("TODO(port): converter/parsers/ios.py — validate against fixtures/golden")`.

## Side Effects
- None.

## Verification
- Run: `pnpm test`
