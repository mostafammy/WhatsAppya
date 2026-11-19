# Application Use Cases

## Overview
Application-layer orchestration for `@whatsappya/core`. Implements the `ConvertChat` use case, coordinating transcript discovery, parser resolution, pipeline enrichment stages, and `ChatSession` construction through injected ports.

## Interface
- `[ConvertChat.ts:ConvertChatDeps]`: Exported interface with `readonly parsers: ParserRegistry`, `readonly stages: readonly PipelineStage[]`, and optional `readonly logger?: Logger`.
- `[ConvertChat.ts:ConvertChatInput]`: Exported interface with `readonly files: FileSource` and optional `readonly ownerName?: string`.
- `[ConvertChat.ts:ConvertChat]`: Exported class with `constructor(private readonly deps: ConvertChatDeps)` and `async execute(input: ConvertChatInput): Promise<Result<ChatSession, ConversionError>>`.

## Invariants
- `[ConvertChat.ts:CHAT_FILE]`: Chat transcript selection matches `/(^|\/)(_chat|WhatsApp Chat.*)\.txt$/i` against `f.path` from `input.files.list()`.
- `[ConvertChat.ts:ConvertChat.execute]`: Defaults `logger` to `silentLogger` (`this.deps.logger ?? silentLogger`) and `ownerName` to `null` (`input.ownerName ?? null`).
- `[ConvertChat.ts:ConvertChat.execute]`: Returns typed `Result` errors rather than throwing: `err({ code: "CHAT_FILE_NOT_FOUND" })` when no file matches `CHAT_FILE`, `err({ code: "UNSUPPORTED_FORMAT", sample: text.slice(0, 200) })` when `this.deps.parsers.resolve(text)` returns falsy, and `err({ code: "EMPTY_CHAT" })` when `parser.parse(text).length === 0`.
- `[ConvertChat.ts:ConvertChat.execute]`: Seeds each parsed message at index `i` with `id: "m" + i`, `timestamp: null`, `direction: Direction.Received`, `attachment: null`, `isDeleted: false`, and `isEdited: false` before invoking `runPipeline`.
- `[ConvertChat.ts:ConvertChat.execute]`: Aggregates `senderCounts` only for truthy `m.sender` values, derives `contactName` via `Object.keys(senderCounts).find((s) => s !== ownerName) ?? "WhatsApp Chat"`, and returns ``ok({ schemaVersion: 1, title: `Chat with ${contactName}`, contactName, ownerName, dateOrder: DateOrder.DayFirst, messages, senderCounts })``.
- `[ConvertChat.ts:ConvertChat.execute]`: Wraps execution in `try/catch`, converting any thrown exception into `err({ code: "IO_FAILURE", cause })`.

## Side Effects
- `[ConvertChat.ts:ConvertChat.execute]`: Calls `await input.files.list()` and `await input.files.readText(entry.path)` on the injected `FileSource` port.
- `[ConvertChat.ts:ConvertChat.execute]`: Emits `log.debug("parser.selected", { id: parser.id })` via the injected `Logger` (or `silentLogger`).
- `[ConvertChat.ts:ConvertChat.execute]`: Invokes `await runPipeline(this.deps.stages, seed, { files: input.files, ownerName })`, passing `input.files` into configured pipeline stages.

## Verification
- Run: `pnpm test`
