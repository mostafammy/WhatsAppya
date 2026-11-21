import { describe, expect, it } from "vitest";
import {
  OpfsArchiveStore,
  type OpfsDirectoryHandle,
  type OpfsFileHandle,
  type OpfsWritableStream,
} from "../src/storage/OpfsArchiveStore.js";

function createMockOpfsRoot(): OpfsDirectoryHandle {
  class MemFile implements OpfsFileHandle {
    readonly kind = "file" as const;
    #bytes = new Uint8Array(0);
    constructor(readonly name: string) {}

    async getFile(): Promise<File> {
      return new File([this.#bytes], this.name);
    }

    async createWritable(): Promise<OpfsWritableStream> {
      const chunks: Uint8Array[] = [];
      return {
        write: async (data) => {
          if (typeof data === "string") {
            chunks.push(new TextEncoder().encode(data));
          } else if (data instanceof Blob) {
            chunks.push(new Uint8Array(await data.arrayBuffer()));
          } else if (ArrayBuffer.isView(data)) {
            chunks.push(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
          } else {
            chunks.push(new Uint8Array(data));
          }
        },
        close: async () => {
          const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
          const merged = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.byteLength;
          }
          this.#bytes = merged;
        },
      };
    }
  }

  class MemDir implements OpfsDirectoryHandle {
    readonly kind = "directory" as const;
    readonly #dirs = new Map<string, MemDir>();
    readonly #files = new Map<string, MemFile>();

    constructor(readonly name: string) {}

    async getDirectoryHandle(
      name: string,
      options?: { create?: boolean },
    ): Promise<OpfsDirectoryHandle> {
      const existing = this.#dirs.get(name);
      if (existing) return existing;
      if (!options?.create) throw new Error(`Directory not found: ${name}`);
      const created = new MemDir(name);
      this.#dirs.set(name, created);
      return created;
    }

    async getFileHandle(name: string, options?: { create?: boolean }): Promise<OpfsFileHandle> {
      const existing = this.#files.get(name);
      if (existing) return existing;
      if (!options?.create) throw new Error(`File not found: ${name}`);
      const created = new MemFile(name);
      this.#files.set(name, created);
      return created;
    }

    async removeEntry(name: string): Promise<void> {
      if (!this.#dirs.delete(name) && !this.#files.delete(name)) {
        throw new Error(`Entry not found: ${name}`);
      }
    }
  }

  return new MemDir("root");
}

describe("OpfsArchiveStore", () => {
  it("saves, inspects metadata, loads, and clears a .zip archive", async () => {
    const root = createMockOpfsRoot();
    const store = new OpfsArchiveStore(async () => root);
    const zipBytes = new Uint8Array([80, 75, 3, 4, 1, 2, 3, 4]);
    const zipFile = new File([zipBytes], "WhatsApp Chat - Cardio.zip", {
      type: "application/zip",
    });

    const meta = await store.saveZip(zipFile, "WhatsApp Chat - Cardio");
    expect(meta.kind).toBe("zip");
    expect(meta.fileCount).toBe(1);
    expect(meta.totalBytes).toBe(zipBytes.byteLength);

    const readMeta = await store.getMetadata();
    expect(readMeta?.rootName).toBe("WhatsApp Chat - Cardio");
    expect(readMeta?.zipFileName).toBe("WhatsApp Chat - Cardio.zip");

    const restored = await store.load();
    expect(restored?.kind).toBe("zip");
    if (restored?.kind === "zip") {
      expect(restored.file.name).toBe("WhatsApp Chat - Cardio.zip");
      expect(new Uint8Array(await restored.file.arrayBuffer())).toEqual(zipBytes);
    }

    await store.clear();
    expect(await store.getMetadata()).toBeNull();
    expect(await store.load()).toBeNull();
  });

  it("saves nested folders, sanitizes unsafe paths, skips metadata junk, and overwrites cleanly", async () => {
    const root = createMockOpfsRoot();
    const store = new OpfsArchiveStore(async () => root);

    // Seed an earlier zip first
    await store.saveZip(new File([new Uint8Array([1, 2])], "old.zip"), "Old");

    const chatFile = new File(["18/11/2026, 10:00 AM - Alex: Hello"], "_chat.txt", {
      type: "text/plain",
    });
    const photoFile = new File([new Uint8Array([255, 216, 255])], "photo.jpg", {
      type: "image/jpeg",
    });
    const dsStore = new File([new Uint8Array([0])], ".DS_Store");
    const macosx = new File([new Uint8Array([0])], "._chat.txt");

    const meta = await store.saveFolder(
      [
        { path: "Chat/../_chat.txt", file: chatFile },
        { path: "/Chat/media\\photo.jpg", file: photoFile },
        { path: "Chat/.DS_Store", file: dsStore },
        { path: "__MACOSX/._chat.txt", file: macosx },
      ],
      "Chat",
    );

    expect(meta.kind).toBe("folder");
    expect(meta.fileCount).toBe(2);
    expect(meta.paths).toEqual(["Chat/_chat.txt", "Chat/media/photo.jpg"]);

    const restored = await store.load();
    expect(restored?.kind).toBe("folder");
    if (restored?.kind === "folder") {
      expect(restored.items).toHaveLength(2);
      expect(restored.items[0]?.path).toBe("Chat/_chat.txt");
      expect(await restored.items[0]?.file.text()).toContain("Alex: Hello");
      const secondItem = restored.items[1];
      expect(secondItem?.path).toBe("Chat/media/photo.jpg");
      if (secondItem) {
        expect(new Uint8Array(await secondItem.file.arrayBuffer())).toEqual(
          new Uint8Array([255, 216, 255]),
        );
      }
    }
  });
});
