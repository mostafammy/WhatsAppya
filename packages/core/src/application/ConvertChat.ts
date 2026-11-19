import { DateOrder, Direction } from "../domain/enums.js";
import type { ConversionError } from "../domain/errors.js";
import type { ChatMessage, ChatSession } from "../domain/models.js";
import type { ParserRegistry } from "../parsers/ParserRegistry.js";
import { type PipelineStage, runPipeline } from "../pipeline/PipelineStage.js";
import { DirectionStage, resolveParticipants } from "../pipeline/stages/DirectionStage.js";
import { MediaStage } from "../pipeline/stages/MediaStage.js";
import { TimestampStage, detectDateOrder } from "../pipeline/stages/TimestampStage.js";
import type { FileSource } from "../ports/FileSource.js";
import { type Logger, silentLogger } from "../ports/Logger.js";
import { type Result, err, ok } from "../shared/result.js";

const CHAT_FILE = /(^|\/)(_chat|WhatsApp Chat.*)\.txt$/i;

export interface ConvertChatDeps {
  readonly parsers: ParserRegistry;
  readonly stages?: readonly PipelineStage[] | undefined;
  readonly logger?: Logger | undefined;
}

export interface ConvertChatInput {
  readonly files: FileSource;
  readonly ownerName?: string | undefined;
  readonly chatPath?: string | undefined;
}

/** USE CASE (application service): orchestrates parsers and pipelines; pure domain logic. */
export class ConvertChat {
  readonly #stages: readonly PipelineStage[];

  constructor(private readonly deps: ConvertChatDeps) {
    this.#stages = deps.stages ?? [new MediaStage(), new TimestampStage(), new DirectionStage()];
  }

  async execute(input: ConvertChatInput): Promise<Result<ChatSession, ConversionError>> {
    const log = this.deps.logger ?? silentLogger;
    try {
      const fileList = await input.files.list();
      let entry = input.chatPath
        ? fileList.find((f) => f.path === input.chatPath)
        : fileList.find((f) => CHAT_FILE.test(f.path));

      if (!entry) {
        // Fallback: look for any .txt file with 'chat' or any .txt file
        entry =
          fileList.find((f) => f.path.toLowerCase().endsWith("_chat.txt")) ||
          fileList.find((f) => f.path.toLowerCase().includes("chat") && f.path.endsWith(".txt")) ||
          fileList.find((f) => f.path.endsWith(".txt"));
      }

      if (!entry) return err({ code: "CHAT_FILE_NOT_FOUND" });

      const text = await input.files.readText(entry.path);
      const parser = this.deps.parsers.resolve(text);
      if (!parser) return err({ code: "UNSUPPORTED_FORMAT", sample: text.slice(0, 200) });
      log.debug("parser.selected", { id: parser.id });

      const raw = parser.parse(text);
      if (raw.length === 0) return err({ code: "EMPTY_CHAT" });

      const seed: ChatMessage[] = raw.map((m, i) => ({
        id: `m${i}`,
        rawDate: m.rawDate,
        rawTime: m.rawTime,
        timestamp: null,
        sender: m.sender,
        text: m.text,
        kind: m.kind,
        direction: Direction.Received,
        attachment: null,
        isDeleted: m.isDeleted ?? false,
        isEdited: m.isEdited ?? false,
      }));

      const ownerName = input.ownerName ?? null;
      const messages = await runPipeline(this.#stages, seed, {
        files: input.files,
        ownerName,
        chatPath: input.chatPath ?? entry.path,
      });

      const senderCounts: Record<string, number> = {};
      for (const m of messages) {
        if (m.sender) {
          senderCounts[m.sender] = (senderCounts[m.sender] ?? 0) + 1;
        }
      }

      const participants = resolveParticipants({
        senderCounts,
        explicitOwner: ownerName,
        chatPath: input.chatPath ?? entry.path,
        messages,
      });

      const resolvedOwner = participants.ownerName;
      const resolvedContact = participants.contactName;
      const dateOrder = detectDateOrder(messages);

      return ok({
        schemaVersion: 1,
        title: `Chat with ${resolvedContact}`,
        contactName: resolvedContact,
        ownerName: resolvedOwner,
        dateOrder,
        messages,
        senderCounts,
      });
    } catch (cause) {
      return err({ code: "IO_FAILURE", cause });
    }
  }
}
