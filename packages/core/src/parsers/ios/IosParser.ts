import type { RawMessage } from "../../domain/models.js";
import type { ChatParser } from "../ChatParser.js";

/** iOS dialect: `[DD/MM/YYYY, HH:MM:SS] Sender: text`. Port of converter/parsers/ios.py. */
export class IosParser implements ChatParser {
  readonly id = "ios";
  static readonly #LINE =
    /^\u200e?\[(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}),?\s+([\d:]+(?:\s?[APap]\.?[Mm]\.?)?)\]\s/;

  canHandle(sampleLines: readonly string[]): boolean {
    return sampleLines.some((l) => IosParser.#LINE.test(l));
  }

  parse(_text: string): readonly RawMessage[] {
    throw new Error("TODO(port): converter/parsers/ios.py — validate against fixtures/golden");
  }
}
