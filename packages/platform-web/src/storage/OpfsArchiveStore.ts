import type { NamedFile } from "../fs/FileListSource.js";

const ARCHIVE_DIR = "whatsappya-last-archive";
const FILES_DIR = "files";
const META_FILE = "meta.json";

export interface OpfsWritableStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  close(): Promise<void>;
}

export interface OpfsFileHandle {
  readonly kind: "file";
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<OpfsWritableStream>;
}

export interface OpfsDirectoryHandle {
  readonly kind: "directory";
  readonly name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<OpfsDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<OpfsFileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
}

export interface StoredArchiveMeta {
  readonly version: 1;
  readonly kind: "zip" | "folder";
  readonly rootName: string;
  readonly savedAt: string;
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly zipFileName?: string | undefined;
  readonly paths?: readonly string[] | undefined;
}

export type RestoredArchive =
  | {
      readonly kind: "zip";
      readonly rootName: string;
      readonly meta: StoredArchiveMeta;
      readonly file: File;
    }
  | {
      readonly kind: "folder";
      readonly rootName: string;
      readonly meta: StoredArchiveMeta;
      readonly items: readonly NamedFile[];
    };

/**
 * Persists the most recently opened WhatsApp export (`.zip` or unzipped folder) inside the
 * Origin Private File System (OPFS) so page reloads resume instantaneously on-device.
 */
export class OpfsArchiveStore {
  static isSupported(): boolean {
    return (
      typeof navigator !== "undefined" && typeof navigator.storage?.getDirectory === "function"
    );
  }

  readonly #getRoot: () => Promise<OpfsDirectoryHandle>;

  constructor(getRoot?: () => Promise<OpfsDirectoryHandle>) {
    this.#getRoot =
      getRoot ??
      (() => navigator.storage.getDirectory() as unknown as Promise<OpfsDirectoryHandle>);
  }

  async saveZip(file: File, rootName: string): Promise<StoredArchiveMeta> {
    await this.clear();
    const root = await this.#getRoot();
    const archiveDir = await root.getDirectoryHandle(ARCHIVE_DIR, { create: true });
    const filesDir = await archiveDir.getDirectoryHandle(FILES_DIR, { create: true });

    const segments = sanitizeRelativePath(file.name);
    const safeFileName = segments[segments.length - 1] ?? "archive.zip";
    const fileHandle = await filesDir.getFileHandle(safeFileName, { create: true });
    await writeBlobToHandle(fileHandle, file);

    const meta: StoredArchiveMeta = {
      version: 1,
      kind: "zip",
      rootName,
      savedAt: new Date().toISOString(),
      fileCount: 1,
      totalBytes: file.size,
      zipFileName: safeFileName,
    };
    await writeMeta(archiveDir, meta);
    return meta;
  }

  async saveFolder(items: readonly NamedFile[], rootName: string): Promise<StoredArchiveMeta> {
    await this.clear();
    const root = await this.#getRoot();
    const archiveDir = await root.getDirectoryHandle(ARCHIVE_DIR, { create: true });
    const filesDir = await archiveDir.getDirectoryHandle(FILES_DIR, { create: true });

    const savedPaths: string[] = [];
    const seen = new Set<string>();
    let totalBytes = 0;

    for (const item of items) {
      const segments = sanitizeRelativePath(item.path);
      if (segments.length === 0) continue;

      const relPath = segments.join("/");
      if (seen.has(relPath)) continue;
      seen.add(relPath);

      let targetDir = filesDir;
      for (let i = 0; i < segments.length - 1; i++) {
        const dirName = segments[i];
        if (!dirName) continue;
        targetDir = await targetDir.getDirectoryHandle(dirName, { create: true });
      }

      const fileName = segments[segments.length - 1];
      if (!fileName) continue;
      const fileHandle = await targetDir.getFileHandle(fileName, { create: true });
      await writeBlobToHandle(fileHandle, item.file);

      savedPaths.push(relPath);
      totalBytes += item.file.size;
    }

    const meta: StoredArchiveMeta = {
      version: 1,
      kind: "folder",
      rootName,
      savedAt: new Date().toISOString(),
      fileCount: savedPaths.length,
      totalBytes,
      paths: savedPaths,
    };
    await writeMeta(archiveDir, meta);
    return meta;
  }

  async getMetadata(): Promise<StoredArchiveMeta | null> {
    try {
      const root = await this.#getRoot();
      const archiveDir = await root.getDirectoryHandle(ARCHIVE_DIR);
      const metaHandle = await archiveDir.getFileHandle(META_FILE);
      const file = await metaHandle.getFile();
      const parsed = JSON.parse(await file.text()) as Partial<StoredArchiveMeta> | null;
      if (
        !parsed ||
        parsed.version !== 1 ||
        (parsed.kind !== "zip" && parsed.kind !== "folder") ||
        typeof parsed.rootName !== "string"
      ) {
        return null;
      }
      return parsed as StoredArchiveMeta;
    } catch {
      return null;
    }
  }

  async load(): Promise<RestoredArchive | null> {
    const meta = await this.getMetadata();
    if (!meta) return null;

    try {
      const root = await this.#getRoot();
      const archiveDir = await root.getDirectoryHandle(ARCHIVE_DIR);
      const filesDir = await archiveDir.getDirectoryHandle(FILES_DIR);

      if (meta.kind === "zip") {
        if (!meta.zipFileName) return null;
        const handle = await filesDir.getFileHandle(meta.zipFileName);
        const file = await handle.getFile();
        return { kind: "zip", rootName: meta.rootName, meta, file };
      }

      const items: NamedFile[] = [];
      for (const relPath of meta.paths ?? []) {
        const segments = sanitizeRelativePath(relPath);
        if (segments.length === 0) continue;

        let dir = filesDir;
        for (let i = 0; i < segments.length - 1; i++) {
          const seg = segments[i];
          if (!seg) continue;
          dir = await dir.getDirectoryHandle(seg);
        }

        const fileName = segments[segments.length - 1];
        if (!fileName) continue;
        const handle = await dir.getFileHandle(fileName);
        const file = await handle.getFile();
        items.push({ path: segments.join("/"), file });
      }

      if (items.length === 0) return null;
      return { kind: "folder", rootName: meta.rootName, meta, items };
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      const root = await this.#getRoot();
      await root.removeEntry(ARCHIVE_DIR, { recursive: true });
    } catch {
      // Ignore missing archive directory
    }
  }
}

export function sanitizeRelativePath(raw: string): string[] {
  const parts = raw
    .replace(/\\/g, "/")
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "." && s !== "..");

  for (const part of parts) {
    if (part === "__MACOSX" || part === ".DS_Store") {
      return [];
    }
  }
  return parts;
}

async function writeBlobToHandle(handle: OpfsFileHandle, blob: Blob): Promise<void> {
  const writable = await handle.createWritable();
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await writable.write(bytes);
  } finally {
    await writable.close();
  }
}

async function writeMeta(archiveDir: OpfsDirectoryHandle, meta: StoredArchiveMeta): Promise<void> {
  const handle = await archiveDir.getFileHandle(META_FILE, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(JSON.stringify(meta));
  } finally {
    await writable.close();
  }
}
