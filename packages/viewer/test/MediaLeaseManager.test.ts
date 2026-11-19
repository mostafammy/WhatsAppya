import { describe, expect, it } from "vitest";
import { MediaLeaseManager } from "../src/media/MediaLeaseManager.js";

describe("MediaLeaseManager", () => {
  it("tracks refcounts and avoids evicting actively leased media", async () => {
    const manager = new MediaLeaseManager(100);
    manager.setResolver({
      resolveMedia: async (fileName) => {
        if (fileName === "a.jpg") return new Blob([new Uint8Array(60)]);
        if (fileName === "b.jpg") return new Blob([new Uint8Array(60)]);
        return new Blob([new Uint8Array(20)]);
      },
    });

    // Mock URL.createObjectURL / revokeObjectURL in Node test env
    let counter = 0;
    const revoked: string[] = [];
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => `blob:mock-${++counter}`;
    URL.revokeObjectURL = (url: string) => {
      revoked.push(url);
    };

    try {
      const urlA = await manager.acquire("a.jpg", "image/jpeg");
      expect(urlA).toBe("blob:mock-1");
      expect(manager.activeBytes).toBe(60);

      // Acquire b.jpg (total 120 > 100), but a.jpg is still leased (refCount = 1), so a.jpg MUST NOT be evicted
      const urlB = await manager.acquire("b.jpg", "image/jpeg");
      expect(urlB).toBe("blob:mock-2");
      expect(revoked).toHaveLength(0);

      // Release a.jpg and acquire c.jpg -> now a.jpg has refCount=0 and is LRU, so it gets evicted
      manager.release("a.jpg");
      await manager.acquire("c.jpg", "image/jpeg");
      expect(revoked).toEqual(["blob:mock-1"]);
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});
