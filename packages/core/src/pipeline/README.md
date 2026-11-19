# Pipeline

## Overview
Sequential message enrichment pipeline contracts and execution runner for `@whatsappya/core`. Defines the stage interface (`PipelineStage`), shared execution context (`PipelineContext`), and async stage composition function (`runPipeline`).

## Interface
- `[PipelineStage.ts:PipelineContext]`: Exported interface with `readonly files: FileSource` and `readonly ownerName: string | null`.
- `[PipelineStage.ts:PipelineStage]`: Exported interface with `readonly name: string` and `process(messages: readonly ChatMessage[], ctx: PipelineContext): Promise<readonly ChatMessage[]>`.
- `[PipelineStage.ts:runPipeline]`: Exported async function `runPipeline(stages: readonly PipelineStage[], initial: readonly ChatMessage[], ctx: PipelineContext): Promise<readonly ChatMessage[]>`.
- `./stages`: [Pipeline Stages](./stages/README.md) — planned `PipelineStage` implementations to be ported from `converter/pipeline/`.

## Invariants
- `[PipelineStage.ts:PipelineContext]`: Compile-time `readonly` constraint on `files` and `ownerName` (no runtime freezing or validation).
- `[PipelineStage.ts:PipelineStage]`: Compile-time `readonly` constraint on `name`, input `messages: readonly ChatMessage[]`, and returned `Promise<readonly ChatMessage[]>`.
- `[PipelineStage.ts:runPipeline]`: Executes `stages` sequentially in array order via `await stage.process(current, ctx)`, threading each stage's returned array into the next stage and returning `initial` unchanged when `stages` is empty.

## Side Effects
- None (the pipeline runner itself is pure async orchestration; individual stage implementations may read from `ctx.files`).

## Verification
- Run: `pnpm test`
