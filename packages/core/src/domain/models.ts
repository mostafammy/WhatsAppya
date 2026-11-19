import type { DateOrder, Direction, MediaKind, MessageKind } from "./enums.js";

/** Immutable value object describing an attachment. Bytes are NOT held here — see `FileSource`. */
export interface Attachment {
  readonly fileName: string;
  readonly kind: MediaKind;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly isOmitted: boolean;
  readonly isAnimated?: boolean;
  readonly durationSeconds?: number;
  readonly waveformPeaks?: readonly number[];
}

/** Raw line-level record produced by a parser, before enrichment. */
export interface RawMessage {
  readonly rawDate: string;
  readonly rawTime: string;
  readonly sender: string | null;
  readonly text: string;
  readonly kind: MessageKind;
  readonly isDeleted?: boolean;
  readonly isEdited?: boolean;
}

/** Fully enriched, immutable message entity conforming to contracts/chat-session.schema.json. */
export interface ChatMessage {
  readonly id: string;
  readonly rawDate: string;
  readonly rawTime: string;
  readonly timestamp: string | null; // ISO-8601 UTC string (e.g. 2025-03-12T10:15:00.000Z), null when date is ambiguous/unparseable
  readonly sender: string | null;
  readonly text: string;
  readonly kind: MessageKind;
  readonly direction: Direction;
  readonly isDeleted: boolean;
  readonly isEdited: boolean;
  readonly attachment: Attachment | null;
}

/** Aggregate root conforming to contracts/chat-session.schema.json. */
export interface ChatSession {
  readonly schemaVersion: 1;
  readonly title: string;
  readonly contactName: string;
  readonly ownerName: string | null;
  readonly dateOrder: DateOrder;
  readonly messages: readonly ChatMessage[];
  readonly senderCounts: Readonly<Record<string, number>>;
}
