import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { ZipFileSource } from "../src/zip/ZipFileSource.js";

describe("ZipFileSource", () => {
  it("indexes central directory and reads files on demand", async () => {
    const zipBytes = zipSync({
      "_chat.txt": new TextEncoder().encode(
        "[12/03/2025, 10:15:00 AM] Alice: Hello!\n[12/03/2025, 10:16:00 AM] Bob: Hi Alice!",
      ),
      "subfolder/photo.jpg": new Uint8Array([1, 2, 3, 4, 5]),
    });

    const blob = new Blob([zipBytes]);
    const source = await ZipFileSource.fromBlob(blob);

    const list = await source.list();
    expect(list).toHaveLength(2);
    expect(list.map((e) => e.path)).toContain("_chat.txt");
    expect(list.map((e) => e.path)).toContain("subfolder/photo.jpg");

    const chatText = await source.readText("_chat.txt");
    expect(chatText).toContain("Alice: Hello!");

    const photoBytes = await source.readBytes("subfolder/photo.jpg");
    expect(photoBytes).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });
});
