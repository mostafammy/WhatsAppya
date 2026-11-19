import {
  AndroidParser,
  ConvertArchive,
  ConvertChat,
  IosParser,
  ParserRegistry,
} from "@whatsappya/core";
import type { ZipFileSource } from "@whatsappya/platform-web";
import type { MediaSourceResolver } from "@whatsappya/viewer";

export const createParserRegistry = (): ParserRegistry =>
  new ParserRegistry().register(new IosParser()).register(new AndroidParser());

export const createConvertChat = (): ConvertChat =>
  new ConvertChat({
    parsers: createParserRegistry(),
  });

export const createConvertArchive = (): ConvertArchive =>
  new ConvertArchive({
    parsers: createParserRegistry(),
  });

/**
 * Resolves attachment filenames from ZipFileSource using zero-copy `sliceBlob()`.
 */
export class ZipMediaResolver implements MediaSourceResolver {
  #basenameIndex: Map<string, string> | null = null;

  constructor(private readonly zip: ZipFileSource) {}

  async resolveMedia(fileName: string, mimeType: string): Promise<Blob | string> {
    if (!this.#basenameIndex) {
      const entries = await this.zip.list();
      this.#basenameIndex = new Map();
      for (const entry of entries) {
        const normalized = entry.path.replace(/\\/g, "/");
        const base = normalized.split("/").pop() ?? normalized;
        this.#basenameIndex.set(normalized.toLowerCase(), entry.path);
        this.#basenameIndex.set(base.toLowerCase(), entry.path);
      }
    }

    const resolvedPath = this.#basenameIndex.get(fileName.toLowerCase()) ?? fileName;
    return this.zip.sliceBlob(resolvedPath, mimeType);
  }
}
