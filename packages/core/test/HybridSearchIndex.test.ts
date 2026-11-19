import { describe, expect, it } from "vitest";
import { DateOrder, Direction, MessageKind } from "../src/domain/enums.js";
import type { ChatMessage, ChatSession } from "../src/domain/models.js";
import { HybridSearchIndex, normalizeSearchText } from "../src/search/HybridSearchIndex.js";

function makeSession(messages: ChatMessage[], contactName = "Doctor"): ChatSession {
  return {
    schemaVersion: 1,
    title: `Chat with ${contactName}`,
    contactName,
    ownerName: "Student",
    dateOrder: DateOrder.DayFirst,
    messages,
    senderCounts: {},
  };
}

function makeMessage(id: string, text: string, sender = "Doctor"): ChatMessage {
  return {
    id,
    rawDate: "17/11/2026",
    rawTime: "10:00 AM",
    timestamp: "2026-11-17T10:00:00.000Z",
    sender,
    text,
    kind: MessageKind.Message,
    direction: Direction.Received,
    isDeleted: false,
    isEdited: false,
    attachment: null,
  };
}

describe("HybridSearchIndex", () => {
  it("normalizes Arabic tashkeel, alef variants, teh marbuta, and alef maksura", () => {
    expect(normalizeSearchText("إبْرَاهِيمُ مُصْطَفَى")).toBe("ابراهيم مصطفي");
    expect(normalizeSearchText("مَكْتَبَة")).toBe("مكتبه");
  });

  it("matches exact words, prefixes, Arabic normalized text, and URL fallbacks", () => {
    const index = new HybridSearchIndex();
    index.indexSession(
      makeSession([
        makeMessage("m0", "Welcome to Cardiology Lecture 1"),
        makeMessage("m1", "محاضرة أمراض القلب والأوعية الدموية"),
        makeMessage("m2", "Check slides at https://github.com/apple/swift/issues/42"),
        makeMessage("m3", "Review atrial fibrillation ECG criteria"),
      ]),
      "ch1",
    );

    // Prefix + multi-term intersection
    const cardioHits = index.search({ text: "cardio lect" });
    expect(cardioHits).toHaveLength(1);
    expect(cardioHits[0]?.messageId).toBe("m0");

    // Arabic normalization (alef without hamza + teh marbuta -> heh)
    const arabicHits = index.search({ text: "محاضره امراض" });
    expect(arabicHits).toHaveLength(1);
    expect(arabicHits[0]?.messageId).toBe("m1");

    // Tier 2 linear fallback for URL/punctuation query
    const urlHits = index.search({ text: "github.com/apple/swift" });
    expect(urlHits).toHaveLength(1);
    expect(urlHits[0]?.messageId).toBe("m2");
  });

  it("scopes queries by chapterId and queries 50,000 messages under 20 ms", () => {
    const msgs: ChatMessage[] = [];
    for (let i = 0; i < 50_000; i++) {
      msgs.push(
        makeMessage(
          `m${i}`,
          i === 42_123
            ? "Rare aortic dissection clinical vignette"
            : `Standard lecture note number ${i} covering physiology`,
        ),
      );
    }

    const index = new HybridSearchIndex();
    index.indexSession(makeSession(msgs), "cardio-1");
    index.indexSession(makeSession([makeMessage("other-0", "aortic valve stenosis")]), "cardio-2");
    index.commit();

    const t0 = performance.now();
    const hits = index.search({ text: "aortic dissection", chapterId: "cardio-1" });
    const elapsedMs = performance.now() - t0;

    expect(hits).toHaveLength(1);
    expect(hits[0]?.messageId).toBe("m42123");
    expect(hits[0]?.docIndex).toBe(42_123);
    expect(elapsedMs).toBeLessThan(20);
  });
});
