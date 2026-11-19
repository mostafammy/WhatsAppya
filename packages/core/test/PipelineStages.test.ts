import { describe, expect, it } from "vitest";
import { DateOrder, Direction, MessageKind } from "../src/domain/enums.js";
import type { ChatMessage } from "../src/domain/models.js";
import { DirectionStage, resolveParticipants } from "../src/pipeline/stages/DirectionStage.js";
import { LinkStage } from "../src/pipeline/stages/LinkStage.js";
import { MediaStage } from "../src/pipeline/stages/MediaStage.js";
import {
  TimestampStage,
  detectDateOrder,
  parseIsoTimestamp,
} from "../src/pipeline/stages/TimestampStage.js";
import type { FileSource } from "../src/ports/FileSource.js";

const createMockFileSource = (files: Record<string, number>): FileSource => ({
  list: async () => Object.entries(files).map(([path, sizeBytes]) => ({ path, sizeBytes })),
  readText: async () => "",
  readBytes: async () => new Uint8Array(),
});

describe("MediaStage", () => {
  const stage = new MediaStage();

  it("resolves iOS attachment tags, omitted media, and stickers", async () => {
    const files = createMockFileSource({
      "photo.jpg": 1024,
      "audio.opus": 4096,
      "STK-2025.webp": 2048,
    });

    const messages: ChatMessage[] = [
      {
        id: "m0",
        rawDate: "12/03/2025",
        rawTime: "10:15:00 AM",
        timestamp: null,
        sender: "Alice",
        text: "<attached: photo.jpg> Check this out!",
        kind: MessageKind.Message,
        direction: Direction.Received,
        isDeleted: false,
        isEdited: false,
        attachment: null,
      },
      {
        id: "m1",
        rawDate: "12/03/2025",
        rawTime: "10:16:00 AM",
        timestamp: null,
        sender: "Bob",
        text: "<Media omitted>",
        kind: MessageKind.Message,
        direction: Direction.Sent,
        isDeleted: false,
        isEdited: false,
        attachment: null,
      },
      {
        id: "m2",
        rawDate: "12/03/2025",
        rawTime: "10:17:00 AM",
        timestamp: null,
        sender: "Bob",
        text: "audio.opus (file attached)",
        kind: MessageKind.Message,
        direction: Direction.Sent,
        isDeleted: false,
        isEdited: false,
        attachment: null,
      },
      {
        id: "m3",
        rawDate: "12/03/2025",
        rawTime: "10:18:00 AM",
        timestamp: null,
        sender: "Alice",
        text: "<attached: STK-2025.webp>",
        kind: MessageKind.Message,
        direction: Direction.Received,
        isDeleted: false,
        isEdited: false,
        attachment: null,
      },
    ];

    const processed = await stage.process(messages, { files, ownerName: "Bob" });

    // m0: image
    expect(processed[0]?.attachment).not.toBeNull();
    expect(processed[0]?.attachment?.fileName).toBe("photo.jpg");
    expect(processed[0]?.attachment?.kind).toBe("image");
    expect(processed[0]?.attachment?.sizeBytes).toBe(1024);
    expect(processed[0]?.text).toBe("Check this out!");

    // m1: omitted
    expect(processed[1]?.attachment?.isOmitted).toBe(true);
    expect(processed[1]?.attachment?.kind).toBe("omitted");
    expect(processed[1]?.text).toBe("");

    // m2: audio
    expect(processed[2]?.attachment?.kind).toBe("audio");
    expect(processed[2]?.attachment?.fileName).toBe("audio.opus");

    // m3: sticker
    expect(processed[3]?.attachment?.kind).toBe("sticker");
    expect(processed[3]?.attachment?.isAnimated).toBe(true);
  });
});

describe("TimestampStage", () => {
  it("detects Day-First vs Month-First date order", () => {
    const dayFirstMessages = [
      { rawDate: "25/01/2025" } as ChatMessage,
      { rawDate: "02/02/2025" } as ChatMessage,
    ];
    expect(detectDateOrder(dayFirstMessages)).toBe(DateOrder.DayFirst);

    const monthFirstMessages = [
      { rawDate: "01/25/2025" } as ChatMessage,
      { rawDate: "02/02/2025" } as ChatMessage,
    ];
    expect(detectDateOrder(monthFirstMessages)).toBe(DateOrder.MonthFirst);
  });

  it("parses Arabic and 12-hour/24-hour timestamps to UTC ISO strings", () => {
    const ts1 = parseIsoTimestamp("12/03/2025", "10:15:00 AM", DateOrder.DayFirst);
    expect(ts1).toBe("2025-03-12T10:15:00.000Z");

    const ts2 = parseIsoTimestamp("03/12/2025", "10:15:00 PM", DateOrder.MonthFirst);
    expect(ts2).toBe("2025-03-12T22:15:00.000Z");

    const tsArabic = parseIsoTimestamp("12/03/2025", "2:30 م", DateOrder.DayFirst);
    expect(tsArabic).toBe("2025-03-12T14:30:00.000Z");
  });
});

describe("DirectionStage", () => {
  it("resolves contact name from export folder path and assigns directions", () => {
    const res = resolveParticipants({
      senderCounts: { "Doctor Smith": 10, John: 5 },
      chatPath: "WhatsApp Chat - Doctor Smith/_chat.txt",
    });

    expect(res.contactName).toBe("Doctor Smith");
    expect(res.ownerName).toBe("John");
  });

  it("resolves owner name from self-phrases", () => {
    const messages = [
      { sender: "Alice", text: "You turned on end-to-end encryption" } as ChatMessage,
      { sender: "Bob", text: "Got it" } as ChatMessage,
    ];

    const res = resolveParticipants({
      senderCounts: { Alice: 1, Bob: 1 },
      messages,
    });

    expect(res.ownerName).toBe("Alice");
    expect(res.contactName).toBe("Bob");
  });
});

describe("LinkStage", () => {
  it("extracts categorized rich link metadata", () => {
    const text = "Check https://github.com/apple/swift and https://www.youtube.com/watch?v=123";
    const cards = LinkStage.extractUrls(text);

    expect(cards).toHaveLength(2);
    expect(cards[0]?.domain).toBe("github.com");
    expect(cards[0]?.category).toBe("code");
    expect(cards[0]?.icon).toBe("💻");

    expect(cards[1]?.domain).toBe("youtube.com");
    expect(cards[1]?.category).toBe("video");
    expect(cards[1]?.icon).toBe("🎬");
  });
});
