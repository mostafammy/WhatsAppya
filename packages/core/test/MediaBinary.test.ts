import { describe, expect, it } from "vitest";
import { parseOggOpusDuration, patchWebpInfiniteLoop } from "../src/shared/mediaBinary.js";

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
});
