import {
  type ChatSession,
  type HybridSearchHit,
  HybridSearchIndex,
  type SearchQuery,
} from "@whatsappya/core";
import type { AsyncSearchProvider } from "@whatsappya/viewer";
import type { SearchWorkerRequest, SearchWorkerResponse } from "./search.worker.js";

/**
 * Offloads `HybridSearchIndex` indexing and querying to a dedicated Web Worker
 * so 50,000+ message archives index with zero main-thread jank.
 * Gracefully falls back to in-process `HybridSearchIndex` when `Worker` is unavailable.
 */
export class SearchWorkerClient implements AsyncSearchProvider {
  #worker: Worker | null = null;
  #fallbackIndex: HybridSearchIndex | null = null;
  #nextId = 1;
  readonly #pending = new Map<number, (response: SearchWorkerResponse) => void>();

  constructor(useWorker = true) {
    if (useWorker && typeof Worker !== "undefined") {
      try {
        this.#worker = new Worker(new URL("./search.worker.ts", import.meta.url), {
          type: "module",
        });
        this.#worker.addEventListener("message", (event: MessageEvent<SearchWorkerResponse>) => {
          const resolve = this.#pending.get(event.data.id);
          if (resolve) {
            this.#pending.delete(event.data.id);
            resolve(event.data);
          }
        });
      } catch {
        this.#fallbackIndex = new HybridSearchIndex();
      }
    } else {
      this.#fallbackIndex = new HybridSearchIndex();
    }
  }

  async indexSession(session: ChatSession, chapterId = "default"): Promise<void> {
    if (!this.#worker) {
      this.#fallbackIndex?.indexSession(session, chapterId);
      this.#fallbackIndex?.commit();
      return;
    }

    const id = this.#nextId++;
    const req: SearchWorkerRequest = { id, type: "index", session, chapterId };
    await this.#send(req);
  }

  async search(query: SearchQuery): Promise<readonly HybridSearchHit[]> {
    if (!this.#worker) {
      return this.#fallbackIndex?.search(query) ?? [];
    }

    const id = this.#nextId++;
    const req: SearchWorkerRequest = { id, type: "search", query };
    const res = await this.#send(req);
    return res.type === "results" ? res.hits : [];
  }

  dispose(): void {
    this.#worker?.terminate();
    this.#worker = null;
    this.#pending.clear();
  }

  #send(request: SearchWorkerRequest): Promise<SearchWorkerResponse> {
    return new Promise((resolve) => {
      this.#pending.set(request.id, resolve);
      this.#worker?.postMessage(request);
    });
  }
}
