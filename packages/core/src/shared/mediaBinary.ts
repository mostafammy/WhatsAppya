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
