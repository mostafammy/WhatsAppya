import { describe, expect, it } from "vitest";
import { FenwickTree } from "../src/components/message-list/FenwickTree.js";

describe("FenwickTree", () => {
  it("computes prefix sums and binary searches 50,000 variable-height rows in O(log N)", () => {
    const tree = new FenwickTree(50_000, 72);
    expect(tree.totalHeight()).toBe(50_000 * 72);
    expect(tree.prefixSum(100)).toBe(7200);

    // Update row 10 to 200px
    tree.update(10, 200);
    expect(tree.getHeight(10)).toBe(200);
    expect(tree.prefixSum(11)).toBe(10 * 72 + 200);
    expect(tree.totalHeight()).toBe(50_000 * 72 + 128);

    // Offset inside row 10 (starts at 720, ends at 920)
    expect(tree.findIndexByOffset(719)).toBe(9);
    expect(tree.findIndexByOffset(720)).toBe(10);
    expect(tree.findIndexByOffset(919)).toBe(10);
    expect(tree.findIndexByOffset(920)).toBe(11);
  });
});
