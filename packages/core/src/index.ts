/** Public API surface — everything else is internal. */
export * from "./domain/enums.js";
export * from "./domain/hierarchy.js";
export type * from "./domain/models.js";
export type * from "./domain/errors.js";
export type * from "./search/SearchIndex.js";
export {
  HybridSearchIndex,
  normalizeSearchText,
  type HybridSearchHit,
  type IndexedDocument,
} from "./search/HybridSearchIndex.js";
export * from "./shared/result.js";
export * from "./shared/parserRules.js";
export * from "./shared/mediaBinary.js";
export type * from "./ports/FileSource.js";
export * from "./ports/Logger.js";
export type * from "./parsers/ChatParser.js";
export { ParserRegistry } from "./parsers/ParserRegistry.js";
export { IosParser } from "./parsers/ios/IosParser.js";
export { AndroidParser } from "./parsers/android/AndroidParser.js";
export * from "./pipeline/PipelineStage.js";
export { MediaStage } from "./pipeline/stages/MediaStage.js";
export {
  TimestampStage,
  detectDateOrder,
  parseIsoTimestamp,
} from "./pipeline/stages/TimestampStage.js";
export { DirectionStage, resolveParticipants } from "./pipeline/stages/DirectionStage.js";
export { LinkStage } from "./pipeline/stages/LinkStage.js";
export * from "./application/ConvertChat.js";
export * from "./application/ConvertArchive.js";
export * from "./application/ComputeChatStats.js";
