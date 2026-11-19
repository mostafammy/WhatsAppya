import { describe, expect, it } from "vitest";
import { computeChatStats } from "../src/application/ComputeChatStats.js";
import { DateOrder, Direction, MessageKind } from "../src/domain/enums.js";
import type { ChatSession } from "../src/domain/models.js";

describe("computeChatStats", () => {
  it("computes participant shares, hourly distribution, media counts, and top words", () => {
    const session: ChatSession = {
      schemaVersion: 1,
      title: "Chat with Alice",
      contactName: "Alice",
      ownerName: "Bob",
      dateOrder: DateOrder.DayFirst,
      senderCounts: { Alice: 2, Bob: 1 },
      messages: [
        {
          id: "m0",
          rawDate: "17/11/2026",
          rawTime: "09:15:00 AM",
          timestamp: "2026-11-17T09:15:00.000Z",
          sender: "Alice",
          text: "Cardiology lecture cardiology notes",
          kind: MessageKind.Message,
          direction: Direction.Received,
          isDeleted: false,
          isEdited: false,
          attachment: {
            fileName: "slide.jpg",
            kind: "image",
            mimeType: "image/jpeg",
            sizeBytes: 100,
            isOmitted: false,
          },
        },
        {
          id: "m1",
          rawDate: "17/11/2026",
          rawTime: "09:20:00 AM",
          timestamp: "2026-11-17T09:20:00.000Z",
          sender: "Bob",
          text: "Thanks for the cardiology lecture!",
          kind: MessageKind.Message,
          direction: Direction.Sent,
          isDeleted: false,
          isEdited: true,
          attachment: null,
        },
        {
          id: "m2",
          rawDate: "17/11/2026",
          rawTime: "21:00:00",
          timestamp: "2026-11-17T21:00:00.000Z",
          sender: "Alice",
          text: "Voice summary",
          kind: MessageKind.Message,
          direction: Direction.Received,
          isDeleted: false,
          isEdited: false,
          attachment: {
            fileName: "rec.opus",
            kind: "audio",
            mimeType: "audio/ogg; codecs=opus",
            sizeBytes: 500,
            isOmitted: false,
          },
        },
      ],
    };

    const stats = computeChatStats(session);
    expect(stats.totalMessages).toBe(3);
    expect(stats.editedCount).toBe(1);
    expect(stats.participants[0]?.name).toBe("Alice");
    expect(stats.participants[0]?.count).toBe(2);
    expect(stats.mediaCounts.image).toBe(1);
    expect(stats.mediaCounts.audio).toBe(1);
    expect(stats.hourlyActivity[9]).toBe(2);
    expect(stats.hourlyActivity[21]).toBe(1);
    expect(stats.topWords[0]?.word).toBe("cardiology");
    expect(stats.topWords[0]?.count).toBe(3);
  });
});
