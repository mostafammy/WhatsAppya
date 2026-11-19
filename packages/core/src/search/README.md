# Core Search

## Overview
Search contract definitions (`SearchIndex`, `SearchQuery`, `SearchHit`) for indexing individual `ChatSession` chapters or full `CurriculumRoot` hierarchies and running scoped full-text queries inside `@whatsappya/core`.

## Interface
- `[SearchIndex.ts:SearchQuery]`: Exported interface with `readonly text: string`, optional `readonly blockId?: string`, `readonly subjectId?: string`, `readonly chapterId?: string`, and `readonly limit?: number`.
- `[SearchIndex.ts:SearchHit]`: Exported interface with `readonly messageId: string`, `readonly chapterId: string`, `readonly snippet: string`, and `readonly score: number`.
- `[SearchIndex.ts:SearchIndex]`: Exported interface with `indexSession(session: ChatSession, chapterId?: string): void`, `indexCurriculum(root: CurriculumRoot): void`, and `search(query: SearchQuery): readonly SearchHit[]`.

## Invariants
- None.

## Side Effects
- None.

## Verification
- Run: `pnpm test`
