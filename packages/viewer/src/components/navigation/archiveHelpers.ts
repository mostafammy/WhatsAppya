import type { ArchiveFolder, ChatSummaryNode } from "@whatsappya/core";

/** Counts total chat sessions across a recursive ArchiveFolder tree. */
export function countArchiveChats(folder: ArchiveFolder): number {
  let count = folder.chats.length;
  for (const child of folder.children) {
    count += countArchiveChats(child);
  }
  return count;
}

/**
 * Unwraps single-child wrapper folders so a single-chat export never shows
 * redundant nesting.
 */
export function unwrapSingleChat(folder: ArchiveFolder): ChatSummaryNode | null {
  if (countArchiveChats(folder) !== 1) return null;
  let cursor: ArchiveFolder | undefined = folder;
  while (cursor) {
    if (cursor.chats.length === 1) return cursor.chats[0] ?? null;
    cursor = cursor.children[0];
  }
  return null;
}
