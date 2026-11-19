import {
  type ChatSession,
  type HybridSearchHit,
  HybridSearchIndex,
  type SearchQuery,
} from "@whatsappya/core";

export type SearchWorkerRequest =
  | {
      readonly id: number;
      readonly type: "index";
      readonly session: ChatSession;
      readonly chapterId: string;
    }
  | { readonly id: number; readonly type: "search"; readonly query: SearchQuery };

export type SearchWorkerResponse =
  | { readonly id: number; readonly type: "indexed"; readonly size: number }
  | { readonly id: number; readonly type: "results"; readonly hits: readonly HybridSearchHit[] };

const index = new HybridSearchIndex();

self.addEventListener("message", (event: MessageEvent<SearchWorkerRequest>) => {
  const msg = event.data;
  if (msg.type === "index") {
    index.indexSession(msg.session, msg.chapterId);
    index.commit();
    const response: SearchWorkerResponse = { id: msg.id, type: "indexed", size: index.size };
    self.postMessage(response);
  } else if (msg.type === "search") {
    const hits = index.search(msg.query);
    const response: SearchWorkerResponse = { id: msg.id, type: "results", hits };
    self.postMessage(response);
  }
});
