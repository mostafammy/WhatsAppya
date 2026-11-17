import type { RawMessage } from "../domain/models.js";

/** STRATEGY: one implementation per export dialect (iOS, Android, future formats). */
export interface ChatParser {
  readonly id: string;
  /** Cheap heuristic over the first N lines. */
  canHandle(sampleLines: readonly string[]): boolean;
  parse(text: string): readonly RawMessage[];
}
