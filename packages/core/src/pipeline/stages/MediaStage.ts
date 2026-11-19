import type { Attachment, ChatMessage } from "../../domain/models.js";
import type { FileEntry } from "../../ports/FileSource.js";
import {
  ANDROID_ATTACH_PATTERN,
  BIDI_REGEX,
  EDITED_PATTERN,
  IOS_ATTACH_PATTERN,
  OMITTED_PHRASES,
  STICKER_EXTENSIONS,
  classifyExtension,
  resolveMimeType,
  stripBidi,
} from "../../shared/parserRules.js";
import type { PipelineContext, PipelineStage } from "../PipelineStage.js";

/**
 * Pipeline stage resolving attachments from message text against FileSource entries.
 * Operates in O(N) by pre-indexing files into a normalized Map.
 */
export class MediaStage implements PipelineStage {
  readonly name = "MediaStage";

  async process(
    messages: readonly ChatMessage[],
    ctx: PipelineContext,
  ): Promise<readonly ChatMessage[]> {
    const fileEntries = await ctx.files.list();
    const fileIndex = this.#buildFileIndex(fileEntries);

    const result: ChatMessage[] = [];

    for (const msg of messages) {
      let cleanText = msg.text;
      let attachment: Attachment | null = null;

      // 1. Check for omitted media markers
      let isOmittedMarker = false;
      for (const phrase of OMITTED_PHRASES) {
        if (cleanText.includes(phrase)) {
          cleanText = cleanText.replace(phrase, "").replace(BIDI_REGEX, "").trim();
          attachment = {
            fileName: phrase,
            kind: "omitted",
            mimeType: "application/octet-stream",
            sizeBytes: 0,
            isOmitted: true,
          };
          isOmittedMarker = true;
          break;
        }
      }

      if (!isOmittedMarker) {
        let candidateFilename: string | null = null;

        // 2. iOS format: <tag: filename>
        const iosMatch = cleanText.match(IOS_ATTACH_PATTERN);
        if (iosMatch && iosMatch[1] !== undefined) {
          const candidate = stripBidi(iosMatch[1]).trim();
          if (fileIndex.has(candidate.toLowerCase())) {
            candidateFilename = candidate;
            cleanText = cleanText.replace(IOS_ATTACH_PATTERN, "").replace(BIDI_REGEX, "").trim();
          }
        }

        // 3. Android format: filename (file attached)
        if (!candidateFilename) {
          const androidMatch = cleanText.match(ANDROID_ATTACH_PATTERN);
          if (androidMatch && androidMatch[1] !== undefined) {
            const candidate = stripBidi(androidMatch[1]).trim();
            if (fileIndex.has(candidate.toLowerCase())) {
              candidateFilename = candidate;
              cleanText = cleanText
                .replace(ANDROID_ATTACH_PATTERN, "")
                .replace(BIDI_REGEX, "")
                .trim();
            }
          }
        }

        // 4. Strip trailing edited markers if present
        if (EDITED_PATTERN.test(cleanText)) {
          cleanText = cleanText.replace(EDITED_PATTERN, "").replace(BIDI_REGEX, "").trim();
        }

        // 5. Construct attachment entity if file exists
        if (candidateFilename) {
          const entry = fileIndex.get(candidateFilename.toLowerCase());
          const sizeBytes = entry ? entry.sizeBytes : 0;
          const extMatch = candidateFilename.match(/\.[^.]+$/);
          const ext = extMatch ? extMatch[0].toLowerCase() : "";
          const upper = candidateFilename.toUpperCase();

          const isSticker =
            STICKER_EXTENSIONS.has(ext) || upper.startsWith("STK-") || upper.includes("-STICKER-");

          const kind = isSticker ? "sticker" : classifyExtension(ext);
          const mimeType = resolveMimeType(ext);

          const isAnimated = isSticker && ext === ".webp" ? true : undefined;

          attachment = {
            fileName: candidateFilename,
            kind,
            mimeType,
            sizeBytes,
            isOmitted: false,
            ...(isAnimated !== undefined ? { isAnimated } : {}),
          };
        }
      }

      result.push({
        id: msg.id,
        rawDate: msg.rawDate,
        rawTime: msg.rawTime,
        timestamp: msg.timestamp,
        sender: msg.sender,
        text: cleanText,
        kind: msg.kind,
        direction: msg.direction,
        isDeleted: msg.isDeleted,
        isEdited: msg.isEdited,
        attachment: attachment ?? msg.attachment,
      });
    }

    return result;
  }

  #buildFileIndex(entries: readonly FileEntry[]): Map<string, FileEntry> {
    const map = new Map<string, FileEntry>();
    for (const entry of entries) {
      const normalizedPath = entry.path.replace(/\\/g, "/");
      const baseName = normalizedPath.split("/").pop() ?? normalizedPath;
      map.set(baseName.toLowerCase(), entry);
      map.set(normalizedPath.toLowerCase(), entry);
    }
    return map;
  }
}
