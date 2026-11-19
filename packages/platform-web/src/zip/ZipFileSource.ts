import type { FileEntry, FileSource } from "@whatsappya/core";
import { inflateSync } from "fflate";

export interface ZipEntryMeta {
  readonly path: string;
  readonly sizeBytes: number;
  readonly compressedSize: number;
  readonly compressionMethod: number;
  readonly localHeaderOffset: number;
}

/**
 * Enterprise-grade, zero-copy ZIP FileSource adapter.
 * Uses a two-step tail slice to index Central Directory in O(entries) without
 * buffering the whole ZIP archive into memory.
 */
export class ZipFileSource implements FileSource {
  readonly #blob: Blob;
  readonly #entries: Map<string, ZipEntryMeta>;
  readonly #fileList: FileEntry[];

  private constructor(blob: Blob, entries: Map<string, ZipEntryMeta>, fileList: FileEntry[]) {
    this.#blob = blob;
    this.#entries = entries;
    this.#fileList = fileList;
  }

  static async fromBlob(blob: Blob): Promise<ZipFileSource> {
    const totalSize = blob.size;
    if (totalSize < 22) {
      throw new Error("Invalid ZIP archive: file too small for EOCD");
    }

    // 1. Read last 65,557 bytes for EOCD record
    const tailReadLength = Math.min(totalSize, 65557);
    const tailOffset = totalSize - tailReadLength;
    const tailBuf = new Uint8Array(await blob.slice(tailOffset, totalSize).arrayBuffer());
    const tailView = new DataView(tailBuf.buffer, tailBuf.byteOffset, tailBuf.byteLength);

    // Locate EOCD signature 0x06054b50 (from end backwards)
    let eocdRelPos = -1;
    for (let i = tailBuf.length - 22; i >= 0; i--) {
      if (tailView.getUint32(i, true) === 0x06054b50) {
        eocdRelPos = i;
        break;
      }
    }

    if (eocdRelPos === -1) {
      throw new Error("Invalid ZIP archive: End of Central Directory record not found");
    }

    let cdEntries = tailView.getUint16(eocdRelPos + 10, true);
    let cdSize = tailView.getUint32(eocdRelPos + 12, true);
    let cdOffset = tailView.getUint32(eocdRelPos + 16, true);

    // Check for Zip64 Locator 20 bytes before EOCD
    const zip64LocPos = eocdRelPos - 20;
    if (zip64LocPos >= 0 && tailView.getUint32(zip64LocPos, true) === 0x07064b50) {
      const zip64EocdOffset = Number(tailView.getBigUint64(zip64LocPos + 8, true));
      const zip64Buf = new Uint8Array(
        await blob.slice(zip64EocdOffset, zip64EocdOffset + 56).arrayBuffer(),
      );
      const zip64View = new DataView(zip64Buf.buffer, zip64Buf.byteOffset, zip64Buf.byteLength);
      if (zip64View.getUint32(0, true) === 0x06064b50) {
        cdEntries = Number(zip64View.getBigUint64(32, true));
        cdSize = Number(zip64View.getBigUint64(40, true));
        cdOffset = Number(zip64View.getBigUint64(48, true));
      }
    }

    // 2. Slice and parse Central Directory
    const cdBuf = new Uint8Array(await blob.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
    const cdView = new DataView(cdBuf.buffer, cdBuf.byteOffset, cdBuf.byteLength);

    const entriesMap = new Map<string, ZipEntryMeta>();
    const fileList: FileEntry[] = [];
    const textDecoder = new TextDecoder("utf-8");

    let cursor = 0;
    while (cursor < cdBuf.length) {
      if (cursor + 46 > cdBuf.length) break;
      const sig = cdView.getUint32(cursor, true);
      if (sig !== 0x02014b50) break; // End of CDFH entries

      const compressionMethod = cdView.getUint16(cursor + 10, true);
      let compressedSize = cdView.getUint32(cursor + 20, true);
      let uncompressedSize = cdView.getUint32(cursor + 24, true);
      const fileNameLen = cdView.getUint16(cursor + 28, true);
      const extraLen = cdView.getUint16(cursor + 30, true);
      const commentLen = cdView.getUint16(cursor + 32, true);
      let localHeaderOffset = cdView.getUint32(cursor + 42, true);

      const fileNameBytes = cdBuf.subarray(cursor + 46, cursor + 46 + fileNameLen);
      const fileName = textDecoder.decode(fileNameBytes);

      // Check Zip64 Extra Field (ID 0x0001) if sizes or offset were 0xffffffff
      let extraCursor = cursor + 46 + fileNameLen;
      const extraEnd = extraCursor + extraLen;
      while (extraCursor + 4 <= extraEnd) {
        const extraId = cdView.getUint16(extraCursor, true);
        const extraDataSize = cdView.getUint16(extraCursor + 2, true);
        extraCursor += 4;
        if (extraId === 0x0001) {
          let fieldOffset = extraCursor;
          if (uncompressedSize === 0xffffffff && fieldOffset + 8 <= extraEnd) {
            uncompressedSize = Number(cdView.getBigUint64(fieldOffset, true));
            fieldOffset += 8;
          }
          if (compressedSize === 0xffffffff && fieldOffset + 8 <= extraEnd) {
            compressedSize = Number(cdView.getBigUint64(fieldOffset, true));
            fieldOffset += 8;
          }
          if (localHeaderOffset === 0xffffffff && fieldOffset + 8 <= extraEnd) {
            localHeaderOffset = Number(cdView.getBigUint64(fieldOffset, true));
          }
        }
        extraCursor += extraDataSize;
      }

      cursor += 46 + fileNameLen + extraLen + commentLen;

      // Skip directory entries ending with '/'
      if (fileName.endsWith("/")) continue;

      const meta: ZipEntryMeta = {
        path: fileName,
        sizeBytes: uncompressedSize,
        compressedSize,
        compressionMethod,
        localHeaderOffset,
      };

      entriesMap.set(fileName, meta);
      entriesMap.set(fileName.toLowerCase(), meta);
      fileList.push({ path: fileName, sizeBytes: uncompressedSize });
    }

    return new ZipFileSource(blob, entriesMap, fileList);
  }

  async list(): Promise<readonly FileEntry[]> {
    return this.#fileList;
  }

  async readText(path: string): Promise<string> {
    const bytes = await this.readBytes(path);
    return new TextDecoder("utf-8").decode(bytes);
  }

  async readBytes(path: string): Promise<Uint8Array> {
    const entry = this.#entries.get(path) ?? this.#entries.get(path.toLowerCase());
    if (!entry) {
      throw new Error(`ZIP entry not found: ${path}`);
    }

    // Read 30-byte Local File Header to determine exact payload offset
    const lfhHeaderBuf = new Uint8Array(
      await this.#blob.slice(entry.localHeaderOffset, entry.localHeaderOffset + 30).arrayBuffer(),
    );
    const lfhView = new DataView(
      lfhHeaderBuf.buffer,
      lfhHeaderBuf.byteOffset,
      lfhHeaderBuf.byteLength,
    );

    if (lfhView.getUint32(0, true) !== 0x04034b50) {
      throw new Error(`Invalid local file header signature for entry: ${path}`);
    }

    const localNameLen = lfhView.getUint16(26, true);
    const localExtraLen = lfhView.getUint16(28, true);
    const dataOffset = entry.localHeaderOffset + 30 + localNameLen + localExtraLen;

    const compressedSlice = this.#blob.slice(dataOffset, dataOffset + entry.compressedSize);
    const compressedBytes = new Uint8Array(await compressedSlice.arrayBuffer());

    // Method 0: STORE (uncompressed)
    if (entry.compressionMethod === 0) {
      return compressedBytes;
    }

    // Method 8: DEFLATE
    if (entry.compressionMethod === 8) {
      // Use DecompressionStream if available in global environment
      if (typeof DecompressionStream !== "undefined") {
        try {
          const ds = new DecompressionStream("deflate-raw");
          const decompressedStream = compressedSlice.stream().pipeThrough(ds);
          const response = new Response(decompressedStream);
          const buffer = await response.arrayBuffer();
          return new Uint8Array(buffer);
        } catch {
          // Fallback to fflate inflateSync
        }
      }
      return inflateSync(compressedBytes);
    }

    throw new Error(`Unsupported compression method: ${entry.compressionMethod}`);
  }

  /**
   * Returns a direct zero-copy slice of the underlying Blob for uncompressed (STORE) media assets.
   */
  async sliceBlob(path: string, mimeType = "application/octet-stream"): Promise<Blob> {
    const entry = this.#entries.get(path) ?? this.#entries.get(path.toLowerCase());
    if (!entry) {
      throw new Error(`ZIP entry not found: ${path}`);
    }

    if (entry.compressionMethod !== 0) {
      const bytes = await this.readBytes(path);
      return new Blob([bytes as unknown as BlobPart], { type: mimeType });
    }

    const lfhHeaderBuf = new Uint8Array(
      await this.#blob.slice(entry.localHeaderOffset, entry.localHeaderOffset + 30).arrayBuffer(),
    );
    const lfhView = new DataView(
      lfhHeaderBuf.buffer,
      lfhHeaderBuf.byteOffset,
      lfhHeaderBuf.byteLength,
    );
    const localNameLen = lfhView.getUint16(26, true);
    const localExtraLen = lfhView.getUint16(28, true);
    const dataOffset = entry.localHeaderOffset + 30 + localNameLen + localExtraLen;

    return this.#blob.slice(dataOffset, dataOffset + entry.sizeBytes, mimeType);
  }
}
