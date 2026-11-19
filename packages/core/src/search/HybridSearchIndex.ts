import type { CurriculumRoot } from "../domain/hierarchy.js";
import type { ChatMessage, ChatSession } from "../domain/models.js";
import type { SearchHit, SearchIndex, SearchQuery } from "./SearchIndex.js";

export interface IndexedDocument {
  readonly messageId: string;
  readonly docIndex: number;
  readonly chapterId: string;
  readonly blockId: string | undefined;
  readonly subjectId: string | undefined;
  readonly sender: string | null;
  readonly rawText: string;
  readonly normalizedText: string;
}

export interface HybridSearchHit extends SearchHit {
  readonly docIndex: number;
  readonly matchOffset: number;
  readonly sender: string | null;
}

const TASHKEEL_REGEX = /[\u064B-\u065F\u0670]/g;
const ALEF_REGEX = /[أإآ]/g;
const TOKEN_SPLIT_REGEX = /[^\p{L}\p{N}]+/u;
const NON_WORD_QUERY_REGEX = /[^\p{L}\p{N}\s]/u;

/**
 * Normalizes Arabic diacritics/letter variants and lowercases Latin text
 * so search matches across vocalized/unvocalized Arabic and mixed-case Latin.
 */
export function normalizeSearchText(input: string): string {
  return input
    .replace(TASHKEEL_REGEX, "")
    .replace(ALEF_REGEX, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();
}

/**
 * Two-tier hybrid search index:
 * - Tier 1: Compact `Uint32Array` inverted posting lists for < 2 ms word/prefix queries.
 * - Tier 2: Normalized linear scan fallback (< 10 ms) for punctuation, URLs, or infix substrings.
 */
export class HybridSearchIndex implements SearchIndex {
  readonly #docs: IndexedDocument[] = [];
  readonly #postings = new Map<string, number[]>();
  #compiledPostings = new Map<string, Uint32Array>();
  #sortedTerms: string[] = [];
  #dirty = false;

  get size(): number {
    return this.#docs.length;
  }

  indexSession(session: ChatSession, chapterId = "default"): void {
    this.#indexMessages(session.messages, chapterId, undefined, undefined);
  }

  indexCurriculum(root: CurriculumRoot): void {
    for (const block of root.blocks) {
      for (const subject of block.subjects) {
        for (const chapter of subject.chapters) {
          this.#indexMessages(chapter.session.messages, chapter.id, block.id, subject.id);
        }
      }
    }
  }

  #indexMessages(
    messages: readonly ChatMessage[],
    chapterId: string,
    blockId: string | undefined,
    subjectId: string | undefined,
  ): void {
    this.#dirty = true;
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg) continue;

      const searchableText = msg.sender ? `${msg.sender}: ${msg.text}` : msg.text;
      if (!searchableText.trim()) continue;

      const normalized = normalizeSearchText(searchableText);
      const docId = this.#docs.length;

      this.#docs.push({
        messageId: msg.id,
        docIndex: i,
        chapterId,
        blockId,
        subjectId,
        sender: msg.sender,
        rawText: msg.text,
        normalizedText: normalized,
      });

      const tokens = normalized.split(TOKEN_SPLIT_REGEX);
      const seenInDoc = new Set<string>();
      for (const token of tokens) {
        if (token.length === 0 || seenInDoc.has(token)) continue;
        seenInDoc.add(token);
        let list = this.#postings.get(token);
        if (!list) {
          list = [];
          this.#postings.set(token, list);
        }
        list.push(docId);
      }
    }
  }

  /** Finalizes `Uint32Array` posting lists and sorted vocabulary for O(log V) prefix lookup. */
  commit(): void {
    if (!this.#dirty) return;
    this.#compiledPostings = new Map();
    const terms: string[] = [];
    for (const [token, list] of this.#postings) {
      this.#compiledPostings.set(token, Uint32Array.from(list));
      terms.push(token);
    }
    terms.sort();
    this.#sortedTerms = terms;
    this.#dirty = false;
  }

  search(query: SearchQuery): readonly HybridSearchHit[] {
    const rawQuery = query.text.trim();
    if (!rawQuery) return [];

    this.commit();
    const limit = query.limit ?? 50;
    const normalizedQuery = normalizeSearchText(rawQuery);

    // If query has punctuation/URL characters or single short token that may be an infix,
    // use Tier 1 first when purely alphanumeric tokens, and fall back to Tier 2 if needed.
    const useLinearOnly = NON_WORD_QUERY_REGEX.test(rawQuery);
    if (!useLinearOnly) {
      const queryTokens = normalizedQuery.split(TOKEN_SPLIT_REGEX).filter((t) => t.length > 0);
      if (queryTokens.length > 0) {
        const tier1Hits = this.#searchInverted(queryTokens, normalizedQuery, query, limit);
        if (tier1Hits.length > 0) {
          return tier1Hits;
        }
      }
    }

    return this.#searchLinearFallback(normalizedQuery, query, limit);
  }

  #searchInverted(
    queryTokens: readonly string[],
    normalizedQuery: string,
    query: SearchQuery,
    limit: number,
  ): HybridSearchHit[] {
    // Gather matching docId sets per query token (exact + prefix match)
    const tokenMatchSets: Uint32Array[] = [];

    for (const qToken of queryTokens) {
      const matchedIds: number[] = [];
      const exact = this.#compiledPostings.get(qToken);
      if (exact) {
        for (let i = 0; i < exact.length; i++) {
          const val = exact[i];
          if (val !== undefined) matchedIds.push(val);
        }
      }

      // O(log V) binary-search prefix expansion for partial typing (e.g. "cardio" -> "cardiology")
      if (qToken.length >= 2) {
        let lo = 0;
        let hi = this.#sortedTerms.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          const midTerm = this.#sortedTerms[mid];
          if (midTerm !== undefined && midTerm < qToken) {
            lo = mid + 1;
          } else {
            hi = mid;
          }
        }
        let expanded = 0;
        for (let idx = lo; idx < this.#sortedTerms.length && expanded < 64; idx++) {
          const term = this.#sortedTerms[idx];
          if (term === undefined || !term.startsWith(qToken)) break;
          if (term === qToken) continue;
          expanded++;
          const posting = this.#compiledPostings.get(term);
          if (posting) {
            for (let i = 0; i < posting.length; i++) {
              const val = posting[i];
              if (val !== undefined) matchedIds.push(val);
            }
          }
        }
      }

      if (matchedIds.length === 0) return [];
      matchedIds.sort((a, b) => a - b);
      // Deduplicate sorted array
      const deduped: number[] = [];
      let prev = -1;
      for (const id of matchedIds) {
        if (id !== prev) {
          deduped.push(id);
          prev = id;
        }
      }
      tokenMatchSets.push(Uint32Array.from(deduped));
    }

    // Intersect sorted Uint32Arrays (smallest first)
    tokenMatchSets.sort((a, b) => a.length - b.length);
    const first = tokenMatchSets[0];
    if (!first) return [];

    let candidates = first;
    for (let s = 1; s < tokenMatchSets.length; s++) {
      const next = tokenMatchSets[s];
      if (!next) continue;
      candidates = intersectSortedUint32(candidates, next);
      if (candidates.length === 0) return [];
    }

    const hits: HybridSearchHit[] = [];
    for (let i = 0; i < candidates.length && hits.length < limit; i++) {
      const docId = candidates[i];
      if (docId === undefined) continue;
      const doc = this.#docs[docId];
      if (!doc || !this.#matchesScope(doc, query)) continue;

      const offset = doc.normalizedText.indexOf(normalizedQuery);
      const firstToken = queryTokens[0] ?? "";
      const fallbackOffset = offset >= 0 ? offset : doc.normalizedText.indexOf(firstToken);
      const matchOffset = Math.max(0, fallbackOffset);
      const score = offset >= 0 ? 1.0 : 0.75;

      hits.push({
        messageId: doc.messageId,
        chapterId: doc.chapterId,
        docIndex: doc.docIndex,
        matchOffset,
        sender: doc.sender,
        snippet: buildSnippet(doc.rawText, matchOffset, rawLength(normalizedQuery)),
        score,
      });
    }

    return hits;
  }

  #searchLinearFallback(
    normalizedQuery: string,
    query: SearchQuery,
    limit: number,
  ): HybridSearchHit[] {
    const hits: HybridSearchHit[] = [];
    for (const doc of this.#docs) {
      if (!this.#matchesScope(doc, query)) continue;
      const idx = doc.normalizedText.indexOf(normalizedQuery);
      if (idx !== -1) {
        hits.push({
          messageId: doc.messageId,
          chapterId: doc.chapterId,
          docIndex: doc.docIndex,
          matchOffset: idx,
          sender: doc.sender,
          snippet: buildSnippet(doc.rawText, idx, normalizedQuery.length),
          score: 0.6,
        });
        if (hits.length >= limit) break;
      }
    }
    return hits;
  }

  #matchesScope(doc: IndexedDocument, query: SearchQuery): boolean {
    if (query.chapterId && doc.chapterId !== query.chapterId) return false;
    if (query.blockId && doc.blockId !== query.blockId) return false;
    if (query.subjectId && doc.subjectId !== query.subjectId) return false;
    return true;
  }
}

function intersectSortedUint32(a: Uint32Array, b: Uint32Array): Uint32Array {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const va = a[i];
    const vb = b[j];
    if (va === undefined || vb === undefined) break;
    if (va === vb) {
      out.push(va);
      i++;
      j++;
    } else if (va < vb) {
      i++;
    } else {
      j++;
    }
  }
  return Uint32Array.from(out);
}

function rawLength(s: string): number {
  return Math.max(1, s.length);
}

function buildSnippet(text: string, matchOffset: number, queryLen: number): string {
  if (text.length <= 120) return text;
  const start = Math.max(0, matchOffset - 36);
  const end = Math.min(text.length, matchOffset + queryLen + 64);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}
