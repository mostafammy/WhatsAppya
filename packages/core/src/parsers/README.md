# Chat Parsers

## Overview
Format-detection strategy interface (`ChatParser`), ordered strategy registry (`ParserRegistry`), and platform-specific WhatsApp `.txt` parser implementations (`AndroidParser`, `IosParser`) for `@whatsappya/core`.

## Interface
- `[ChatParser.ts:ChatParser]`: Exported interface defining a WhatsApp export dialect strategy with `readonly id: string`, `canHandle(sampleLines: readonly string[]): boolean`, and `parse(text: string): readonly RawMessage[]`.
- `[ParserRegistry.ts:ParserRegistry]`: Exported class managing registered `ChatParser` strategies.
- `[ParserRegistry.ts:ParserRegistry.register]`: `register(parser: ChatParser): this` — appends a parser to the registry and returns `this` for chaining.
- `[ParserRegistry.ts:ParserRegistry.resolve]`: `resolve(text: string): ChatParser | undefined` — returns the first registered parser matching sample lines or `undefined`.
- `./android`: [Android Chat Parser](./android/README.md) — `AndroidParser` (`id = "android"`) for Android `.txt` export lines.
- `./ios`: [iOS Chat Parser](./ios/README.md) — `IosParser` (`id = "ios"`) for iOS bracketed `.txt` export lines.

## Invariants
- `[ChatParser.ts:ChatParser.id]`: Parser identifier property is `readonly` on `ChatParser` implementations.
- `[ParserRegistry.ts:SAMPLE_SIZE]`: Sample passed to `ChatParser.canHandle` in `[ParserRegistry.ts:ParserRegistry.resolve]` is capped at `SAMPLE_SIZE = 50` lines split on `/\r?\n/`.
- `[ParserRegistry.ts:ParserRegistry.resolve]`: Evaluates parsers in registration order via `Array.prototype.find` on `#parsers` and returns the first match.
- `[ParserRegistry.ts:ParserRegistry.#parsers]`: Internal `#parsers` list reference is `private` and `readonly`.

## Side Effects
- `[ParserRegistry.ts:ParserRegistry.register]`: Mutates the `ParserRegistry` instance's private `#parsers` array by pushing the given parser; performs no I/O or global mutations.

## Verification
- Run: `pnpm test`
