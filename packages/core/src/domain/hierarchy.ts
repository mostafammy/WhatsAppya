import type { ChatSession } from "./models.js";

/** Tier level within a multi-tier curricular archive (Blocks › Subjects › Chapters). */
export const NodeTier = {
  Root: "root",
  Block: "block",
  Subject: "subject",
  Chapter: "chapter",
} as const;
export type NodeTier = (typeof NodeTier)[keyof typeof NodeTier];

/** Shared Composite Pattern base contract for all curricular tree nodes. */
export interface HierarchyNodeBase {
  readonly id: string;
  readonly title: string;
  readonly tier: NodeTier;
}

/** Leaf node wrapping a single parsed WhatsApp chat session. */
export interface ChapterNode extends HierarchyNodeBase {
  readonly tier: typeof NodeTier.Chapter;
  readonly session: ChatSession;
}

/** Subject container grouping ordered chapter chats. */
export interface SubjectNode extends HierarchyNodeBase {
  readonly tier: typeof NodeTier.Subject;
  readonly chapters: readonly ChapterNode[];
}

/** Block container grouping curricular subjects. */
export interface BlockNode extends HierarchyNodeBase {
  readonly tier: typeof NodeTier.Block;
  readonly subjects: readonly SubjectNode[];
}

/** Root composite node for Multi-Tier Curricular Mode. */
export interface CurriculumRoot extends HierarchyNodeBase {
  readonly tier: typeof NodeTier.Root;
  readonly blocks: readonly BlockNode[];
}

/** Discriminated union over all nodes in the curricular composite tree. */
export type HierarchyNode = CurriculumRoot | BlockNode | SubjectNode | ChapterNode;
