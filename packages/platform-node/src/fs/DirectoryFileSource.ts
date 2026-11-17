import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { FileEntry, FileSource } from "@whatsappya/core";

/** ADAPTER: `FileSource` over an unzipped export folder on disk. */
export class DirectoryFileSource implements FileSource {
  constructor(private readonly root: string) {}

  async list(): Promise<readonly FileEntry[]> {
    const names = await readdir(this.root, { recursive: true });
    const entries: FileEntry[] = [];
    for (const name of names) {
      const s = await stat(join(this.root, name));
      if (s.isFile())
        entries.push({ path: relative(this.root, join(this.root, name)), sizeBytes: s.size });
    }
    return entries;
  }

  readText(path: string): Promise<string> {
    return readFile(join(this.root, path), "utf8");
  }

  async readBytes(path: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(join(this.root, path)));
  }
}
