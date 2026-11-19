import { Direction } from "../../domain/enums.js";
import type { ChatMessage } from "../../domain/models.js";
import { SELF_PHRASES } from "../../shared/parserRules.js";
import type { PipelineContext, PipelineStage } from "../PipelineStage.js";

export interface ParticipantResolution {
  readonly ownerName: string | null;
  readonly contactName: string;
}

export interface ResolveParticipantsInput {
  senderCounts: Readonly<Record<string, number>>;
  explicitOwner?: string | null | undefined;
  chatPath?: string | undefined;
  messages?: readonly ChatMessage[] | undefined;
}

/**
 * Resolves conversational direction (sent vs received) and identifies participants
 * matching legacy converter/service.py 3-tier heuristic.
 */
export class DirectionStage implements PipelineStage {
  readonly name = "DirectionStage";

  async process(
    messages: readonly ChatMessage[],
    ctx: PipelineContext,
  ): Promise<readonly ChatMessage[]> {
    const senderCounts: Record<string, number> = {};
    for (const m of messages) {
      if (m.sender) {
        senderCounts[m.sender] = (senderCounts[m.sender] ?? 0) + 1;
      }
    }

    const { ownerName } = resolveParticipants({
      senderCounts,
      explicitOwner: ctx.ownerName,
      chatPath: ctx.chatPath,
      messages,
    });

    const result: ChatMessage[] = [];
    for (const msg of messages) {
      const direction = ownerName && msg.sender === ownerName ? Direction.Sent : Direction.Received;

      result.push({
        id: msg.id,
        rawDate: msg.rawDate,
        rawTime: msg.rawTime,
        timestamp: msg.timestamp,
        sender: msg.sender,
        text: msg.text,
        kind: msg.kind,
        direction,
        isDeleted: msg.isDeleted,
        isEdited: msg.isEdited,
        attachment: msg.attachment,
      });
    }

    return result;
  }
}

export function resolveParticipants(input: ResolveParticipantsInput): ParticipantResolution {
  const { senderCounts, explicitOwner, chatPath, messages } = input;
  const senders = Object.keys(senderCounts);

  if (explicitOwner) {
    const other = senders.find((s) => s !== explicitOwner) ?? "WhatsApp Chat";
    return { ownerName: explicitOwner, contactName: other };
  }

  // 1. WhatsApp export title matching: "WhatsApp Chat - <Contact Name>" or "WhatsApp Chat with <Contact Name>"
  if (chatPath && senders.length === 2) {
    const normalized = chatPath.replace(/\\/g, "/");
    const parts = normalized.split("/");
    const fileName = parts.pop() ?? "";
    const folderName = parts.pop() ?? "";
    const searchTargets = [folderName, fileName, fileName.replace(/\.[^.]+$/, "")];

    const matchedContact = senders.find((sender) =>
      searchTargets.some((target) => target.includes(sender)),
    );

    if (matchedContact) {
      const owner = senders.find((s) => s !== matchedContact) ?? null;
      return { ownerName: owner, contactName: matchedContact };
    }
  }

  // 2. Self phrases ("You turned...", "You deleted...", "أنت حذفت...", "قمت ب...")
  if (messages && senders.length === 2) {
    for (const msg of messages) {
      if (msg.sender && senderCounts[msg.sender] !== undefined) {
        if (SELF_PHRASES.some((phrase) => msg.text.startsWith(phrase))) {
          const owner = msg.sender;
          const other = senders.find((s) => s !== owner) ?? "WhatsApp Chat";
          return { ownerName: owner, contactName: other };
        }
      }
    }
  }

  // 3. Fallback heuristic: sender with fewer messages is 'owner'
  if (senders.length > 0 && senders[0] !== undefined) {
    let minCount = Number.POSITIVE_INFINITY;
    let minSender = senders[0];

    for (const s of senders) {
      const count = senderCounts[s] ?? 0;
      if (count < minCount) {
        minCount = count;
        minSender = s;
      }
    }

    const other = senders.find((s) => s !== minSender) ?? "WhatsApp Chat";
    return { ownerName: minSender, contactName: other };
  }

  return { ownerName: null, contactName: "WhatsApp Chat" };
}
