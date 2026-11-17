/** Mirrors contracts/chat-session.schema.json — keep in sync with Swift `WhatsAppyaCore`. */
export const MessageKind = { Message: "message", System: "system", Call: "call" } as const;
export type MessageKind = (typeof MessageKind)[keyof typeof MessageKind];

export const MediaKind = {
  None: "none",
  Image: "image",
  Video: "video",
  Audio: "audio",
  Pdf: "pdf",
  Document: "document",
  File: "file",
  Sticker: "sticker",
  Omitted: "omitted",
} as const;
export type MediaKind = (typeof MediaKind)[keyof typeof MediaKind];

export const Direction = { Sent: "sent", Received: "received" } as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

export const DateOrder = {
  DayFirst: "day_first",
  MonthFirst: "month_first",
  YearFirst: "year_first",
} as const;
export type DateOrder = (typeof DateOrder)[keyof typeof DateOrder];
