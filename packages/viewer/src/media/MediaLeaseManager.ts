import { patchWebpInfiniteLoop } from "@whatsappya/core";

/**
 * Platform-agnostic resolver for attachment playback/display URLs.
 * Web app wires this to ZipFileSource/OPFS; HTML exports resolve relative paths.
 */
export interface MediaSourceResolver {
  resolveMedia(fileName: string, mimeType: string): Promise<Blob | string>;
}

interface LeaseEntry {
  readonly key: string;
  readonly url: string;
  readonly sizeBytes: number;
  readonly isObjectUrl: boolean;
  refCount: number;
  lastAccess: number;
}

const DEFAULT_MAX_BYTES = 64 * 1024 * 1024; // 64 MB LRU ceiling

/**
 * Reference-counted LRU ObjectURL lease cache.
 * Guarantees active audio, video, or lightbox media is never revoked while leased.
 */
export class MediaLeaseManager {
  readonly #entries = new Map<string, LeaseEntry>();
  readonly #pending = new Map<string, Promise<string>>();
  readonly #maxBytes: number;
  #currentBytes = 0;
  #tick = 0;
  #resolver: MediaSourceResolver | null = null;

  constructor(maxBytes = DEFAULT_MAX_BYTES) {
    this.#maxBytes = maxBytes;
  }

  setResolver(resolver: MediaSourceResolver | null): void {
    if (this.#resolver !== resolver) {
      this.disposeAll();
      this.#resolver = resolver;
    }
  }

  get activeBytes(): number {
    return this.#currentBytes;
  }

  getRefCount(fileName: string): number {
    return this.#entries.get(fileName)?.refCount ?? 0;
  }

  /**
   * Resolves raw underlying `Blob` bytes on demand without pinning a `blob:` ObjectURL.
   * Useful for binary container inspection such as `.was` Lottie sticker archives.
   */
  async resolveRawBlob(fileName: string, mimeType: string): Promise<Blob | null> {
    try {
      if (this.#resolver) {
        const resolved = await this.#resolver.resolveMedia(fileName, mimeType);
        return typeof resolved === "string" ? null : resolved;
      }
      if (typeof fetch === "function") {
        const res = await fetch(encodeURI(fileName));
        return res.ok ? await res.blob() : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  async acquire(fileName: string, mimeType: string): Promise<string> {
    const existing = this.#entries.get(fileName);
    if (existing) {
      existing.refCount++;
      existing.lastAccess = ++this.#tick;
      return existing.url;
    }

    let inflight = this.#pending.get(fileName);
    if (!inflight) {
      inflight = this.#loadAndRegister(fileName, mimeType);
      this.#pending.set(fileName, inflight);
    }

    try {
      const url = await inflight;
      const entry = this.#entries.get(fileName);
      if (entry) {
        entry.refCount++;
        entry.lastAccess = ++this.#tick;
      }
      this.#evictIfNeeded();
      return url;
    } finally {
      this.#pending.delete(fileName);
    }
  }

  release(fileName: string): void {
    const entry = this.#entries.get(fileName);
    if (!entry) return;
    if (entry.refCount > 0) {
      entry.refCount--;
    }
    this.#evictIfNeeded();
  }

  disposeAll(): void {
    for (const entry of this.#entries.values()) {
      if (entry.isObjectUrl && typeof URL !== "undefined" && URL.revokeObjectURL) {
        URL.revokeObjectURL(entry.url);
      }
    }
    this.#entries.clear();
    this.#pending.clear();
    this.#currentBytes = 0;
  }

  async #loadAndRegister(fileName: string, mimeType: string): Promise<string> {
    if (!this.#resolver) {
      // Relative path fallback for standalone/folder HTML exports
      return encodeURI(fileName);
    }

    const resolved = await this.#resolver.resolveMedia(fileName, mimeType);
    if (typeof resolved === "string") {
      this.#entries.set(fileName, {
        key: fileName,
        url: resolved,
        sizeBytes: 0,
        isObjectUrl: false,
        refCount: 0,
        lastAccess: ++this.#tick,
      });
      return resolved;
    }

    let finalBlob = resolved;
    if (mimeType === "image/webp" && resolved.size > 20 && resolved.size <= 2 * 1024 * 1024) {
      const rawBytes = new Uint8Array(await resolved.arrayBuffer());
      const patched = patchWebpInfiniteLoop(rawBytes);
      if (patched.bytes !== rawBytes) {
        finalBlob = new Blob([patched.bytes as unknown as BlobPart], { type: mimeType });
      }
    }

    const url = URL.createObjectURL(finalBlob);
    const sizeBytes = finalBlob.size;
    this.#currentBytes += sizeBytes;
    this.#entries.set(fileName, {
      key: fileName,
      url,
      sizeBytes,
      isObjectUrl: true,
      refCount: 0,
      lastAccess: ++this.#tick,
    });

    return url;
  }

  #evictIfNeeded(): void {
    if (this.#currentBytes <= this.#maxBytes) return;

    const evictable = Array.from(this.#entries.values())
      .filter((e) => e.refCount === 0)
      .sort((a, b) => a.lastAccess - b.lastAccess);

    for (const candidate of evictable) {
      if (this.#currentBytes <= this.#maxBytes) break;
      this.#entries.delete(candidate.key);
      this.#currentBytes = Math.max(0, this.#currentBytes - candidate.sizeBytes);
      if (candidate.isObjectUrl && typeof URL !== "undefined" && URL.revokeObjectURL) {
        URL.revokeObjectURL(candidate.url);
      }
    }
  }
}

export const defaultMediaLeases = new MediaLeaseManager();
