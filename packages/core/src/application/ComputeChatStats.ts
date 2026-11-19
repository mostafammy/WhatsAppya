import type { ChatSession } from "../domain/models.js";
import { normalizeSearchText } from "../search/HybridSearchIndex.js";

export interface ParticipantStat {
  readonly name: string;
  readonly count: number;
  readonly percentage: number;
}

export interface WordFrequency {
  readonly word: string;
  readonly count: number;
}

export interface ChatStats {
  readonly totalMessages: number;
  readonly userMessages: number;
  readonly systemMessages: number;
  readonly callCount: number;
  readonly editedCount: number;
  readonly deletedCount: number;
  readonly participants: readonly ParticipantStat[];
  readonly mediaCounts: Readonly<Record<string, number>>;
  readonly hourlyActivity: readonly number[];
  readonly dateSpan: {
    readonly start: string | null;
    readonly end: string | null;
  };
  readonly topWords: readonly WordFrequency[];
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "you",
  "are",
  "was",
  "have",
  "from",
  "not",
  "but",
  "what",
  "all",
  "your",
  "https",
  "http",
  "www",
  "com",
  "من",
  "في",
  "على",
  "الي",
  "عن",
  "مع",
  "هذا",
  "هذه",
  "كان",
  "ان",
]);

const WORD_SPLIT = /[^\p{L}\p{N}]+/u;

/**
 * Pure O(N) on-device chat analytics computation.
 */
export function computeChatStats(session: ChatSession): ChatStats {
  const hourly = new Array<number>(24).fill(0);
  const mediaCounts: Record<string, number> = {};
  const participantMap = new Map<string, number>();
  const wordCounts = new Map<string, number>();

  let userMessages = 0;
  let systemMessages = 0;
  let callCount = 0;
  let editedCount = 0;
  let deletedCount = 0;
  let firstTs: string | null = null;
  let lastTs: string | null = null;

  for (const msg of session.messages) {
    if (msg.timestamp) {
      if (!firstTs) firstTs = msg.timestamp;
      lastTs = msg.timestamp;
      const hourStr = msg.timestamp.slice(11, 13);
      const hour = Number.parseInt(hourStr, 10);
      if (!Number.isNaN(hour) && hour >= 0 && hour < 24) {
        hourly[hour] = (hourly[hour] ?? 0) + 1;
      }
    }

    if (msg.kind === "system") {
      systemMessages++;
    } else if (msg.kind === "call") {
      callCount++;
    } else {
      userMessages++;
    }

    if (msg.isEdited) editedCount++;
    if (msg.isDeleted) deletedCount++;

    if (msg.sender && msg.kind === "message") {
      participantMap.set(msg.sender, (participantMap.get(msg.sender) ?? 0) + 1);
    }

    if (msg.attachment) {
      const k = msg.attachment.isOmitted ? "omitted" : msg.attachment.kind;
      mediaCounts[k] = (mediaCounts[k] ?? 0) + 1;
    }

    if (msg.kind === "message" && !msg.isDeleted && msg.text) {
      const normalized = normalizeSearchText(msg.text);
      for (const token of normalized.split(WORD_SPLIT)) {
        if (token.length < 3 || STOP_WORDS.has(token) || /^\d+$/.test(token)) continue;
        wordCounts.set(token, (wordCounts.get(token) ?? 0) + 1);
      }
    }
  }

  const participants: ParticipantStat[] = Array.from(participantMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      percentage: userMessages > 0 ? Math.round((count / userMessages) * 1000) / 10 : 0,
    }));

  const topWords: WordFrequency[] = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  return {
    totalMessages: session.messages.length,
    userMessages,
    systemMessages,
    callCount,
    editedCount,
    deletedCount,
    participants,
    mediaCounts,
    hourlyActivity: hourly,
    dateSpan: { start: firstTs, end: lastTs },
    topWords,
  };
}
