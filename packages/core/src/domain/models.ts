import type { DateOrder, Direction, MediaKind, MessageKind } from "./enums.js";

/** Immutable value object describing an attachment. Bytes are NOT held here — see `FileSource`. */
export interface Attachment {
  readonly fileName: string;
  readonly kind: MediaKind;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly isOmitted: boolean;
  readonly isAnimated?: boolean;
}

/** Raw line-level record produced by a parser, before enrichment. */
export interface RawMessage {
  readonly rawDate: string;
  readonly rawTime: string;
  readonly sender: string | null;
  readonly text: string;
  readonly kind: MessageKind;
}

/** Fully enriched, immutable message entity. */
export interface ChatMessage extends RawMessage {
  readonly id: string;
  readonly timestamp: string | null; // ISO-8601, null when the date is ambiguous/unparseable
  readonly direction: Direction;
  readonly attachment: Attachment | null;
  readonly isDeleted: boolean;
  readonly isEdited: boolean;
}

/** Aggregate root. */
export interface ChatSession {
  readonly schemaVersion: 1;
  readonly title: string;
  readonly contactName: string;
  readonly ownerName: string | null;
  readonly dateOrder: DateOrder;
  readonly messages: readonly ChatMessage[];
  readonly senderCounts: Readonly<Record<string, number>>;
}
