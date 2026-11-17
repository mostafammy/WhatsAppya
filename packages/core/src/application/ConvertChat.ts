import { DateOrder, Direction } from "../domain/enums.js";
import type { ConversionError } from "../domain/errors.js";
import type { ChatMessage, ChatSession } from "../domain/models.js";
import type { ParserRegistry } from "../parsers/ParserRegistry.js";
import { type PipelineStage, runPipeline } from "../pipeline/PipelineStage.js";
import type { FileSource } from "../ports/FileSource.js";
import { type Logger, silentLogger } from "../ports/Logger.js";
import { type Result, err, ok } from "../shared/result.js";

const CHAT_FILE = /(^|\/)(_chat|WhatsApp Chat.*)\.txt$/i;

export interface ConvertChatDeps {
  readonly parsers: ParserRegistry;
  readonly stages: readonly PipelineStage[];
  readonly logger?: Logger;
}

export interface ConvertChatInput {
  readonly files: FileSource;
  readonly ownerName?: string;
}

/** USE CASE (application service): orchestrates ports; contains no I/O or UI. */
export class ConvertChat {
  constructor(private readonly deps: ConvertChatDeps) {}

  async execute(input: ConvertChatInput): Promise<Result<ChatSession, ConversionError>> {
    const log = this.deps.logger ?? silentLogger;
    try {
      const entry = (await input.files.list()).find((f) => CHAT_FILE.test(f.path));
      if (!entry) return err({ code: "CHAT_FILE_NOT_FOUND" });

      const text = await input.files.readText(entry.path);
      const parser = this.deps.parsers.resolve(text);
      if (!parser) return err({ code: "UNSUPPORTED_FORMAT", sample: text.slice(0, 200) });
      log.debug("parser.selected", { id: parser.id });

      const raw = parser.parse(text);
      if (raw.length === 0) return err({ code: "EMPTY_CHAT" });

      const seed: ChatMessage[] = raw.map((m, i) => ({
        ...m,
        id: `m${i}`,
        timestamp: null,
        direction: Direction.Received,
        attachment: null,
        isDeleted: false,
        isEdited: false,
      }));

      const ownerName = input.ownerName ?? null;
      const messages = await runPipeline(this.deps.stages, seed, { files: input.files, ownerName });

      const senderCounts: Record<string, number> = {};
      for (const m of messages)
        if (m.sender) senderCounts[m.sender] = (senderCounts[m.sender] ?? 0) + 1;
      const contactName = Object.keys(senderCounts).find((s) => s !== ownerName) ?? "WhatsApp Chat";

      return ok({
        schemaVersion: 1,
        title: `Chat with ${contactName}`,
        contactName,
        ownerName,
        dateOrder: DateOrder.DayFirst,
        messages,
        senderCounts,
      });
    } catch (cause) {
      return err({ code: "IO_FAILURE", cause });
    }
  }
}
