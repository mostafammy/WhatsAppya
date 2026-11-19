import type { FileEntry, FileSource } from "@whatsappya/core";

export interface NamedFile {
  readonly path: string;
  readonly file: File;
}

/**
 * Browser `FileSource` adapter over an unzipped folder (`webkitdirectory` or drag-and-drop directory)
 * or selected files. Zero-copy: holds references to `File` handles directly without buffering into RAM.
 */
export class FileListSource implements FileSource {
  readonly #byPath = new Map<string, File>();
  readonly #byLowerPath = new Map<string, File>();
  readonly #byBaseName = new Map<string, File>();
  readonly #entries: FileEntry[];

  constructor(files: readonly NamedFile[]) {
    this.#entries = [];
    for (const item of files) {
      const normalized = item.path.replace(/\\/g, "/").replace(/^\/+/, "");
      const baseName = normalized.split("/").pop() ?? normalized;
      this.#byPath.set(normalized, item.file);
      this.#byLowerPath.set(normalized.toLowerCase(), item.file);
      this.#byBaseName.set(baseName.toLowerCase(), item.file);
      this.#entries.push({ path: normalized, sizeBytes: item.file.size });
    }
  }

  static fromFileList(fileList: FileList | readonly File[]): FileListSource {
    const items: NamedFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file) continue;
      const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
      items.push({ path: rel && rel.length > 0 ? rel : file.name, file });
    }
    return new FileListSource(items);
  }

  async list(): Promise<readonly FileEntry[]> {
    return this.#entries;
  }

  async readText(path: string): Promise<string> {
    const file = this.#resolve(path);
    return file.text();
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const file = this.#resolve(path);
    return new Uint8Array(await file.arrayBuffer());
  }

  /** Returns the original `File` handle directly as a `Blob` (zero-copy). */
  getBlob(path: string): Blob {
    return this.#resolve(path);
  }

  #resolve(path: string): File {
    const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
    const baseName = normalized.split("/").pop() ?? normalized;
    const found =
      this.#byPath.get(normalized) ??
      this.#byLowerPath.get(normalized.toLowerCase()) ??
      this.#byBaseName.get(baseName.toLowerCase());
    if (!found) {
      throw new Error(`File not found in folder: ${path}`);
    }
    return found;
  }
}

interface WebkitEntry {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly name: string;
  readonly fullPath: string;
  file?(cb: (file: File) => void, err?: (e: unknown) => void): void;
  createReader?(): {
    readEntries(cb: (entries: WebkitEntry[]) => void, err?: (e: unknown) => void): void;
  };
}

/**
 * Recursively collects files from a `DataTransfer` drop event — seamlessly handles
 * a dropped `.zip`, a dropped `_chat.txt`, OR a dropped unzipped WhatsApp export folder.
 */
export async function readDroppedFiles(dataTransfer: DataTransfer): Promise<NamedFile[]> {
  const items = Array.from(dataTransfer.items ?? []);
  const entries: WebkitEntry[] = [];

  for (const item of items) {
    const withEntry = item as DataTransferItem & { webkitGetAsEntry?: () => WebkitEntry | null };
    const entry = withEntry.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  if (entries.length === 0) {
    return Array.from(dataTransfer.files ?? []).map((file) => ({ path: file.name, file }));
  }

  const collected: NamedFile[] = [];
  const walk = async (entry: WebkitEntry): Promise<void> => {
    if (entry.isFile && entry.file) {
      const file = await new Promise<File>((resolve, reject) => {
        entry.file?.(resolve, reject);
      });
      const cleanPath = entry.fullPath.replace(/^\/+/, "") || file.name;
      collected.push({ path: cleanPath, file });
    } else if (entry.isDirectory && entry.createReader) {
      const reader = entry.createReader();
      // readEntries returns batches (up to 100 entries on Chrome) until empty
      while (true) {
        const batch = await new Promise<WebkitEntry[]>((resolve, reject) => {
          reader.readEntries(resolve, reject);
        });
        if (batch.length === 0) break;
        for (const child of batch) {
          await walk(child);
        }
      }
    }
  };

  for (const entry of entries) {
    await walk(entry);
  }
  return collected;
}
