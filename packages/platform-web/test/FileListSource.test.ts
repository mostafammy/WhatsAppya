import { describe, expect, it } from "vitest";
import { FileListSource } from "../src/fs/FileListSource.js";

describe("FileListSource", () => {
  it("resolves chat text and media attachments from an unzipped folder drop", async () => {
    const chatFile = new File(["[17/11/2026, 9:15 AM] Alex: Hello"], "_chat.txt", {
      type: "text/plain",
    });
    const photoFile = new File([new Uint8Array([1, 2, 3])], "photo.jpg", {
      type: "image/jpeg",
    });

    const source = new FileListSource([
      { path: "WhatsApp Chat - Alex/_chat.txt", file: chatFile },
      { path: "WhatsApp Chat - Alex/photo.jpg", file: photoFile },
    ]);

    const entries = await source.list();
    expect(entries).toHaveLength(2);
    expect(await source.readText("WhatsApp Chat - Alex/_chat.txt")).toContain("Hello");
    // Basename lookup works cleanly for attachment resolution
    expect(await source.readBytes("photo.jpg")).toEqual(new Uint8Array([1, 2, 3]));
    expect(source.getBlob("photo.jpg").size).toBe(3);
  });
});
