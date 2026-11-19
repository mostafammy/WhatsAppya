import type { ArchiveFolder } from "@whatsappya/core";
import { describe, expect, it } from "vitest";
import {
  countArchiveChats,
  unwrapSingleChat,
} from "../src/components/navigation/archiveHelpers.js";

describe("Archive adaptive chrome helpers", () => {
  it("unwraps single-child wrapper folders when sessionCount === 1", () => {
    const tree: ArchiveFolder = {
      id: "root",
      name: "Export",
      path: "",
      chats: [],
      children: [
        {
          id: "folder-1",
          name: "WhatsApp Chat - Alice",
          path: "WhatsApp Chat - Alice",
          children: [],
          chats: [
            {
              id: "chat-0",
              title: "Chat with Alice",
              contactName: "Alice",
              messageCount: 42,
              path: "WhatsApp Chat - Alice/_chat.txt",
              exportFormat: "ios",
            },
          ],
        },
      ],
    };

    expect(countArchiveChats(tree)).toBe(1);
    const unwrapped = unwrapSingleChat(tree);
    expect(unwrapped?.contactName).toBe("Alice");
  });

  it("returns null from unwrapSingleChat when multiple chats exist", () => {
    const multi: ArchiveFolder = {
      id: "root",
      name: "Curriculum",
      path: "",
      chats: [
        {
          id: "c1",
          title: "Ch 1",
          contactName: "Dr. A",
          messageCount: 10,
          path: "c1/_chat.txt",
          exportFormat: "ios",
        },
        {
          id: "c2",
          title: "Ch 2",
          contactName: "Dr. B",
          messageCount: 20,
          path: "c2/_chat.txt",
          exportFormat: "android",
        },
      ],
      children: [],
    };

    expect(countArchiveChats(multi)).toBe(2);
    expect(unwrapSingleChat(multi)).toBeNull();
  });
});
