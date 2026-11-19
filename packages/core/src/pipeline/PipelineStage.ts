import type { ChatMessage } from "../domain/models.js";
import type { FileSource } from "../ports/FileSource.js";

export interface PipelineContext {
  readonly files: FileSource;
  readonly ownerName: string | null;
  readonly chatPath?: string;
}

/**
 * PIPELINE / CHAIN OF RESPONSIBILITY: each stage does one thing (SRP)
 * e.g. MediaResolution → EditedDetection → DirectionResolution → Timestamping.
 */
export interface PipelineStage {
  readonly name: string;
  process(messages: readonly ChatMessage[], ctx: PipelineContext): Promise<readonly ChatMessage[]>;
}

export async function runPipeline(
  stages: readonly PipelineStage[],
  initial: readonly ChatMessage[],
  ctx: PipelineContext,
): Promise<readonly ChatMessage[]> {
  let current = initial;
  for (const stage of stages) current = await stage.process(current, ctx);
  return current;
}
