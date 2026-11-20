import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  extractWasLottieJson,
  parseOggOpusDuration,
  patchWebpInfiniteLoop,
} from "../src/shared/mediaBinary.js";

function buildSingleEntryZip(fileName: string, payload: Uint8Array, method: 0 | 8): Uint8Array {
  const nameBytes = new TextEncoder().encode(fileName);
  const data = method === 8 ? new Uint8Array(deflateRawSync(payload)) : payload;

  const lfhSize = 30 + nameBytes.length;
  const cdOffset = lfhSize + data.length;
  const cdSize = 46 + nameBytes.length;
  const totalSize = cdOffset + cdSize + 22;

  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  // Local File Header (0x04034b50)
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(8, method, true);
  view.setUint32(18, data.length, true);
  view.setUint32(22, payload.length, true);
  view.setUint16(26, nameBytes.length, true);
  out.set(nameBytes, 30);
  out.set(data, lfhSize);

  // Central Directory File Header (0x02014b50)
  view.setUint32(cdOffset, 0x02014b50, true);
  view.setUint16(cdOffset + 4, 20, true);
  view.setUint16(cdOffset + 6, 20, true);
  view.setUint16(cdOffset + 10, method, true);
  view.setUint32(cdOffset + 20, data.length, true);
  view.setUint32(cdOffset + 24, payload.length, true);
  view.setUint16(cdOffset + 28, nameBytes.length, true);
  view.setUint32(cdOffset + 42, 0, true); // lfhOffset = 0
  out.set(nameBytes, cdOffset + 46);

  // End of Central Directory (0x06054b50)
  const eocdOffset = cdOffset + cdSize;
  view.setUint32(eocdOffset, 0x06054b50, true);
  view.setUint16(eocdOffset + 8, 1, true);
  view.setUint16(eocdOffset + 10, 1, true);
  view.setUint32(eocdOffset + 12, cdSize, true);
  view.setUint32(eocdOffset + 16, cdOffset, true);

  return out;
}

describe("mediaBinary", () => {
  it("extracts exact Ogg/Opus duration from final OggS granule position", () => {
    const buf = new Uint8Array(32);
    // "OggS" at offset 4
    buf.set([0x4f, 0x67, 0x67, 0x53], 4);
    // 48,000 * 12.5 seconds = 600,000 granules at offset 4 + 6 = 10
    const view = new DataView(buf.buffer);
    view.setBigInt64(10, 600_000n, true);

    expect(parseOggOpusDuration(buf)).toBe(12.5);
  });

  it("patches finite animated WebP loop count to 0 (infinite) in memory without mutating input", () => {
    const raw = new Uint8Array(32);
    // VP8X header at 12..15 + animation flag bit 0x02 at byte 20
    raw.set([0x56, 0x50, 0x38, 0x58], 12);
    raw[20] = 0x02;
    // ANIM chunk at offset 16 (synthetic test offset) with loop count = 3
    const anim = new Uint8Array(36);
    anim.set([0x41, 0x4e, 0x49, 0x4d], 16);
    anim[28] = 3;
    anim[29] = 0;

    const patched = patchWebpInfiniteLoop(anim);
    expect(patched.isAnimated).toBe(true);
    expect(patched.bytes[28]).toBe(0);
    expect(patched.bytes[29]).toBe(0);
    // Original buffer untouched
    expect(anim[28]).toBe(3);
  });

  it("extracts Lottie JSON from STORE and DEFLATE .was sticker archives", async () => {
    const expectedJson = '{"v":"5.9.0","fr":30,"ip":0,"op":60,"w":512,"h":512,"layers":[]}';
    const rawJson = new TextEncoder().encode(expectedJson);

    const storeZip = buildSingleEntryZip("animation/animation.json", rawJson, 0);
    expect(await extractWasLottieJson(storeZip)).toBe(expectedJson);

    const deflateZip = buildSingleEntryZip("animation/animation.json", rawJson, 8);
    expect(await extractWasLottieJson(deflateZip)).toBe(expectedJson);

    expect(await extractWasLottieJson(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
