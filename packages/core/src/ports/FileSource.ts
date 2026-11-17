/**
 * PORT (Hexagonal Architecture / Dependency Inversion).
 * The core never touches zip libraries, the DOM, or `node:fs`.
 * Adapters live in `@whatsappya/platform-web` and `@whatsappya/platform-node`.
 */
export interface FileEntry {
  readonly path: string;
  readonly sizeBytes: number;
}

export interface FileSource {
  list(): Promise<readonly FileEntry[]>;
  readText(path: string): Promise<string>;
  readBytes(path: string): Promise<Uint8Array>;
}
