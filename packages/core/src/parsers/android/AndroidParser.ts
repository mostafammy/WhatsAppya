import type { RawMessage } from "../../domain/models.js";
import type { ChatParser } from "../ChatParser.js";

/** Android dialect: `DD/MM/YYYY, HH:MM - Sender: text`. Port of converter/parsers/android.py. */
export class AndroidParser implements ChatParser {
  readonly id = "android";
  static readonly #LINE =
    /^(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}),?\s+([\d:]+(?:\s?[APap]\.?[Mm]\.?)?)\s+-\s/;

  canHandle(sampleLines: readonly string[]): boolean {
    return sampleLines.some((l) => AndroidParser.#LINE.test(l));
  }

  parse(_text: string): readonly RawMessage[] {
    throw new Error("TODO(port): converter/parsers/android.py — validate against fixtures/golden");
  }
}
