import type { CurriculumRoot } from "../domain/hierarchy.js";
import type { ChatSession } from "../domain/models.js";

/** Query descriptor for sub-20ms in-memory Universal Spotlight Search (⌘K / ⌘F). */
export interface SearchQuery {
  readonly text: string;
  readonly blockId?: string;
  readonly subjectId?: string;
  readonly chapterId?: string;
  readonly limit?: number;
}

/** Ranked search hit pointing to a matching message within a chapter or single session. */
export interface SearchHit {
  readonly messageId: string;
  readonly chapterId: string;
  readonly snippet: string;
  readonly score: number;
}

/** Inverted-index search contract across single sessions and full curricular trees. */
export interface SearchIndex {
  indexSession(session: ChatSession, chapterId?: string): void;
  indexCurriculum(root: CurriculumRoot): void;
  search(query: SearchQuery): readonly SearchHit[];
}
