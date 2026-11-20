/**
 * Pure binary parsers for WhatsApp media containers (zero external dependencies).
 * Operates strictly in memory without mutating files on disk.
 */

/**
 * Extracts exact duration in seconds from an Ogg/Opus binary payload by reading
 * the final `OggS` page's 64-bit little-endian granule position (48 kHz clock).
 */
export function parseOggOpusDuration(bytes: Uint8Array): number | undefined {
  if (bytes.byteLength < 14) return undefined;

  // Scan backwards for last "OggS" (0x4F 0x67 0x67 0x53)
  let idx = -1;
  for (let i = bytes.byteLength - 14; i >= 0; i--) {
    if (
      bytes[i] === 0x4f &&
      bytes[i + 1] === 0x67 &&
      bytes[i + 2] === 0x67 &&
      bytes[i + 3] === 0x53
    ) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return undefined;

  const view = new DataView(bytes.buffer, bytes.byteOffset + idx + 6, 8);
  const granule = Number(view.getBigInt64(0, true));
  if (!Number.isFinite(granule) || granule <= 0) return undefined;

  return Math.round((granule / 48_000) * 100) / 100;
}

export interface WebpPatchResult {
  readonly bytes: Uint8Array;
  readonly isAnimated: boolean;
}

/**
 * Inspects a WebP buffer for animation (`VP8X` bit 0x02 / `ANIM` chunk) and
 * returns an in-memory copy with the `ANIM` loop count patched to 0 (infinite).
 */
export function patchWebpInfiniteLoop(bytes: Uint8Array): WebpPatchResult {
  let isAnimated = false;
  if (
    bytes.byteLength > 20 &&
    bytes[12] === 0x56 && // V
    bytes[13] === 0x50 && // P
    bytes[14] === 0x38 && // 8
    bytes[15] === 0x58 && // X
    ((bytes[20] ?? 0) & 0x02) !== 0
  ) {
    isAnimated = true;
  }

  // Locate "ANIM" (0x41 0x4E 0x49 0x4D)
  let animIdx = -1;
  for (let i = 12; i <= bytes.byteLength - 14; i++) {
    if (
      bytes[i] === 0x41 &&
      bytes[i + 1] === 0x4e &&
      bytes[i + 2] === 0x49 &&
      bytes[i + 3] === 0x4d
    ) {
      animIdx = i;
      break;
    }
  }

  if (animIdx === -1) {
    return { bytes, isAnimated };
  }

  isAnimated = true;
  const loopLow = bytes[animIdx + 12] ?? 0;
  const loopHigh = bytes[animIdx + 13] ?? 0;
  if (loopLow === 0 && loopHigh === 0) {
    return { bytes, isAnimated: true };
  }

  const copy = new Uint8Array(bytes);
  copy[animIdx + 12] = 0;
  copy[animIdx + 13] = 0;
  return { bytes: copy, isAnimated: true };
}

interface WasZipEntry {
  readonly name: string;
  readonly method: number;
  readonly compressedSize: number;
  readonly lfhOffset: number;
}

interface GlobalWebStreams {
  readonly TextDecoder?: new (label?: string) => { decode(input: Uint8Array): string };
  readonly DecompressionStream?: new (format: string) => unknown;
  readonly Blob?: new (
    parts: readonly Uint8Array[],
  ) => {
    stream(): { pipeThrough(transform: unknown): unknown };
  };
  readonly Response?: new (body: unknown) => { text(): Promise<string> };
}

function decodeUtf8(bytes: Uint8Array): string {
  const g = globalThis as unknown as GlobalWebStreams;
  if (typeof g.TextDecoder === "function") {
    return new g.TextDecoder("utf-8").decode(bytes);
  }
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i] ?? 0);
  }
  return out;
}

/**
 * Extracts Lottie animation JSON from a WhatsApp `.was` sticker ZIP archive.
 * Reads the ZIP Central Directory + Local File Header in memory without external deps.
 */
export async function extractWasLottieJson(bytes: Uint8Array): Promise<string | null> {
  if (bytes.byteLength < 22) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tailStart = Math.max(0, bytes.byteLength - 65557);

  let eocdPos = -1;
  for (let i = bytes.byteLength - 22; i >= tailStart; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos === -1) return null;

  const cdSize = view.getUint32(eocdPos + 12, true);
  const cdOffset = view.getUint32(eocdPos + 16, true);
  if (cdOffset + cdSize > bytes.byteLength) return null;

  let cursor = cdOffset;
  const cdEnd = cdOffset + cdSize;
  let primary: WasZipEntry | null = null;
  let fallback: WasZipEntry | null = null;

  while (cursor + 46 <= cdEnd) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;

    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const fileNameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const lfhOffset = view.getUint32(cursor + 42, true);

    const nameStart = cursor + 46;
    if (nameStart + fileNameLen > cdEnd) break;

    const name = decodeUtf8(bytes.subarray(nameStart, nameStart + fileNameLen));
    cursor = nameStart + fileNameLen + extraLen + commentLen;

    const lower = name.toLowerCase();
    if (lower === "animation/animation.json") {
      primary = { name, method, compressedSize, lfhOffset };
      break;
    }
    if (!fallback && lower.endsWith(".json")) {
      fallback = { name, method, compressedSize, lfhOffset };
    }
  }

  const target = primary ?? fallback;
  if (!target || target.lfhOffset + 30 > bytes.byteLength) return null;
  if (view.getUint32(target.lfhOffset, true) !== 0x04034b50) return null;

  const localNameLen = view.getUint16(target.lfhOffset + 26, true);
  const localExtraLen = view.getUint16(target.lfhOffset + 28, true);
  const dataOffset = target.lfhOffset + 30 + localNameLen + localExtraLen;
  if (dataOffset + target.compressedSize > bytes.byteLength) return null;

  const payload = bytes.subarray(dataOffset, dataOffset + target.compressedSize);

  if (target.method === 0) {
    return decodeUtf8(payload);
  }

  if (target.method === 8) {
    const g = globalThis as unknown as GlobalWebStreams;
    if (
      typeof g.DecompressionStream !== "function" ||
      typeof g.Blob !== "function" ||
      typeof g.Response !== "function"
    ) {
      return null;
    }
    try {
      const ds = new g.DecompressionStream("deflate-raw");
      const stream = new g.Blob([payload]).stream().pipeThrough(ds);
      return await new g.Response(stream).text();
    } catch {
      return null;
    }
  }

  return null;
}
