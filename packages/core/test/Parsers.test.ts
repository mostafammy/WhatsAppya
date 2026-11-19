import { describe, expect, it } from "vitest";
import { AndroidParser } from "../src/parsers/android/AndroidParser.js";
import { IosParser } from "../src/parsers/ios/IosParser.js";

describe("IosParser", () => {
  const parser = new IosParser();

  it("identifies iOS bracketed format correctly", () => {
    const lines = [
      "[2/11/25, 2:22:13 PM] Alice: Hello there",
      "[2/11/25, 2:23:00 PM] Bob: Hi Alice",
    ];
    expect(parser.canHandle(lines)).toBe(true);

    const androidLines = [
      "2/11/25, 2:22 PM - Alice: Hello there",
      "2/11/25, 2:23 PM - Bob: Hi Alice",
    ];
    expect(parser.canHandle(androidLines)).toBe(false);
  });

  it("handles Arabic locales, BiDi marks, and message continuation", () => {
    const text = [
      "[\u200f2/11/25، 2:22:13\xa0م] ايمن: \u200fصباح الخير",
      "[\u200f2/11/25، 2:22:20\xa0م] مصطفى: صباح الورد",
      "مع تمنياتي بيوم سعيد",
      "[\u200f2/11/25، 2:22:30\xa0م] ايمن: \u200fتم حذف هذه الرسالة.",
      "[\u200f2/11/25، 2:23:00\xa0م] مصطفى: \u200fمكالمة صوتية, ‏لم يتم الرد",
    ].join("\n");

    const messages = parser.parse(text);
    expect(messages).toHaveLength(4);

    expect(messages[0]?.sender).toBe("ايمن");
    expect(messages[0]?.text).toBe("صباح الخير");
    expect(messages[0]?.kind).toBe("message");

    // Multiline continuation
    expect(messages[1]?.sender).toBe("مصطفى");
    expect(messages[1]?.text).toBe("صباح الورد\nمع تمنياتي بيوم سعيد");

    // Deleted message
    expect(messages[2]?.isDeleted).toBe(true);

    // Call
    expect(messages[3]?.kind).toBe("call");
  });

  it("handles system encryption notice and edited messages", () => {
    const text = [
      "[12/03/2025, 10:00:00 AM] Messages and calls are end-to-end encrypted.",
      "[12/03/2025, 10:01:00 AM] Alice: What's up? <This message was edited>",
    ].join("\n");

    const messages = parser.parse(text);
    expect(messages).toHaveLength(2);

    expect(messages[0]?.kind).toBe("system");
    expect(messages[0]?.sender).toBe(null);

    expect(messages[1]?.sender).toBe("Alice");
    expect(messages[1]?.text).toBe("What's up?");
    expect(messages[1]?.isEdited).toBe(true);
  });
});

describe("AndroidParser", () => {
  const parser = new AndroidParser();

  it("identifies Android hyphen-delimited format correctly", () => {
    const lines = [
      "11/02/2025, 14:22 - Alice: Hi from Android",
      "11/02/2025, 14:23 - Bob: Looks great",
    ];
    expect(parser.canHandle(lines)).toBe(true);

    const iosLines = [
      "[2/11/25, 2:22:13 PM] Alice: Hello there",
      "[2/11/25, 2:23:00 PM] Bob: Hi Alice",
    ];
    expect(parser.canHandle(iosLines)).toBe(false);
  });

  it("parses Arabic edited messages and multiline text", () => {
    const text = [
      "2/28/26, 4:01 PM - Mostafa: ما فيه بليز اهو 😂😂😂 <This message was edited>",
      "2/28/26, 4:02 PM - Alice: Here is another one <تم تعديل هذه الرسالة>",
      "And a follow up line",
      "2/28/26, 4:03 PM - Messages and calls are end-to-end encrypted. No one outside of this chat can read or listen to them.",
    ].join("\n");

    const messages = parser.parse(text);
    expect(messages).toHaveLength(3);

    expect(messages[0]?.isEdited).toBe(true);
    expect(messages[0]?.text).toBe("ما فيه بليز اهو 😂😂😂");

    expect(messages[1]?.isEdited).toBe(true);
    expect(messages[1]?.text).toBe("Here is another one\nAnd a follow up line");

    expect(messages[2]?.kind).toBe("system");
    expect(messages[2]?.sender).toBe(null);
  });
});
