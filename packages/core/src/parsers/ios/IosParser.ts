import type { RawMessage } from "../../domain/models.js";
import {
  CALL_KEYWORDS,
  DELETED_KEYWORDS,
  EDITED_PATTERN,
  ENCRYPTION_KEYWORDS,
  IOS_LINE_PATTERN,
  stripBidi,
} from "../../shared/parserRules.js";
import type { ChatParser } from "../ChatParser.js";

interface CurrentParseState {
  date: string;
  time: string;
  rawRest: string;
}

/**
 * iOS WhatsApp Chat Parser Strategy.
 * Handles bracketed timestamps: `[DD/MM/YY, HH:MM:SS AM] Sender: Message`
 * Unicode Bidirectional markers, Arabic/Latin locales, seconds precision, and multiline continuation.
 */
export class IosParser implements ChatParser {
  readonly id = "ios";

  canHandle(sampleLines: readonly string[]): boolean {
    let matches = 0;
    let total = 0;
    for (const line of sampleLines) {
      const clean = stripBidi(line).trim();
      if (!clean) continue;
      total++;
      if (IOS_LINE_PATTERN.test(clean)) {
        matches++;
      }
    }
    return total > 0 && matches / total >= 0.25;
  }

  parse(text: string): readonly RawMessage[] {
    const lines = text.split(/\r?\n/);
    const messages: RawMessage[] = [];
    let current: CurrentParseState | null = null;

    for (const rawLine of lines) {
      const cleanLine = stripBidi(rawLine).trim();
      const match = cleanLine.match(IOS_LINE_PATTERN);

      if (match && match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
        if (current) {
          messages.push(this.#buildMessage(current));
        }
        current = {
          date: match[1],
          time: match[2],
          rawRest: match[3],
        };
        continue;
      }

      if (current && rawLine.length > 0) {
        current.rawRest += `\n${rawLine}`;
      }
    }

    if (current) {
      messages.push(this.#buildMessage(current));
    }

    return messages;
  }

  #buildMessage(data: CurrentParseState): RawMessage {
    const { date, time, rawRest } = data;
    const isEncryption = ENCRYPTION_KEYWORDS.some((kw) => rawRest.includes(kw));
    const colonIdx = rawRest.indexOf(":");

    if (isEncryption) {
      const text = colonIdx !== -1 ? rawRest.slice(colonIdx + 1).trim() : rawRest.trim();
      return {
        rawDate: date,
        rawTime: time,
        sender: null,
        text,
        kind: "system",
      };
    }

    if (colonIdx !== -1) {
      const sender = rawRest.slice(0, colonIdx).trim();
      let text = rawRest.slice(colonIdx + 1).trim();

      const isEdited = EDITED_PATTERN.test(text);
      if (isEdited) {
        text = text.replace(EDITED_PATTERN, "").trim();
      }

      const isDeleted = DELETED_KEYWORDS.some((kw) => text.includes(kw));
      const isCall = CALL_KEYWORDS.some((kw) => text.includes(kw));
      const kind = isCall ? "call" : "message";

      return {
        rawDate: date,
        rawTime: time,
        sender,
        text,
        kind,
        isDeleted,
        isEdited,
      };
    }

    return {
      rawDate: date,
      rawTime: time,
      sender: null,
      text: rawRest.trim(),
      kind: "system",
    };
  }
}
