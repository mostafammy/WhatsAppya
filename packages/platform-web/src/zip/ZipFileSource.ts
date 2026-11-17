import type { FileEntry, FileSource } from "@whatsappya/core";
import { unzipSync } from "fflate";

/** ADAPTER: implements the core `FileSource` port over an in-memory zip (fflate, ~8 kB). */
export class ZipFileSource implements FileSource {
  readonly #entries: Record<string, Uint8Array>;

  private constructor(entries: Record<string, Uint8Array>) {
    this.#entries = entries;
  }

  static async fromBlob(blob: Blob): Promise<ZipFileSource> {
    return new ZipFileSource(unzipSync(new Uint8Array(await blob.arrayBuffer())));
  }

  async list(): Promise<readonly FileEntry[]> {
    return Object.entries(this.#entries).map(([path, b]) => ({ path, sizeBytes: b.byteLength }));
  }

  async readText(path: string): Promise<string> {
    return new TextDecoder("utf-8").decode(await this.readBytes(path));
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const bytes = this.#entries[path];
    if (!bytes) throw new Error(`Missing entry: ${path}`);
    return bytes;
  }
}
