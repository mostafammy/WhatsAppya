import type { ChatParser } from "./ChatParser.js";

const SAMPLE_SIZE = 50;

/** REGISTRY + FACTORY: new dialects are registered, never hard-coded (Open/Closed). */
export class ParserRegistry {
  readonly #parsers: ChatParser[] = [];

  register(parser: ChatParser): this {
    this.#parsers.push(parser);
    return this;
  }

  resolve(text: string): ChatParser | undefined {
    const sample = text.split(/\r?\n/, SAMPLE_SIZE);
    return this.#parsers.find((p) => p.canHandle(sample));
  }
}
