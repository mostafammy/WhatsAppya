import { DateOrder } from "../../domain/enums.js";
import type { ChatMessage } from "../../domain/models.js";
import { stripBidi } from "../../shared/parserRules.js";
import type { PipelineContext, PipelineStage } from "../PipelineStage.js";

/**
 * Detects overall chat DateOrder convention and computes ISO-8601 UTC timestamps.
 */
export class TimestampStage implements PipelineStage {
  readonly name = "TimestampStage";

  async process(
    messages: readonly ChatMessage[],
    _ctx: PipelineContext,
  ): Promise<readonly ChatMessage[]> {
    const dateOrder = detectDateOrder(messages);

    const result: ChatMessage[] = [];
    for (const msg of messages) {
      const isoTimestamp = parseIsoTimestamp(msg.rawDate, msg.rawTime, dateOrder);
      result.push({
        id: msg.id,
        rawDate: msg.rawDate,
        rawTime: msg.rawTime,
        timestamp: isoTimestamp,
        sender: msg.sender,
        text: msg.text,
        kind: msg.kind,
        direction: msg.direction,
        isDeleted: msg.isDeleted,
        isEdited: msg.isEdited,
        attachment: msg.attachment,
      });
    }

    return result;
  }
}

export function detectDateOrder(messages: readonly ChatMessage[]): DateOrder {
  let hasDayFirst = false;
  let hasMonthFirst = false;

  for (const msg of messages) {
    const clean = stripBidi(msg.rawDate).trim();
    const parts = clean.split(/[/.-]/);
    if (parts.length === 3 && parts[0] !== undefined && parts[1] !== undefined) {
      const p1 = Number.parseInt(parts[0], 10);
      const p2 = Number.parseInt(parts[1], 10);
      if (!Number.isNaN(p1) && !Number.isNaN(p2)) {
        if (p1 > 12) hasDayFirst = true;
        if (p2 > 12) hasMonthFirst = true;
      }
    }
  }

  if (hasMonthFirst && !hasDayFirst) {
    return DateOrder.MonthFirst;
  }
  return DateOrder.DayFirst;
}

export function parseIsoTimestamp(
  rawDate: string,
  rawTime: string,
  order: DateOrder,
): string | null {
  try {
    const cleanDate = stripBidi(rawDate).trim();
    const dateParts = cleanDate.split(/[/.-]/);
    if (
      dateParts.length !== 3 ||
      dateParts[0] === undefined ||
      dateParts[1] === undefined ||
      dateParts[2] === undefined
    ) {
      return null;
    }

    const p1 = Number.parseInt(dateParts[0], 10);
    const p2 = Number.parseInt(dateParts[1], 10);
    let year = Number.parseInt(dateParts[2], 10);

    if (Number.isNaN(p1) || Number.isNaN(p2) || Number.isNaN(year)) return null;
    if (year < 100) year += 2000;

    let month: number;
    let day: number;

    if (order === DateOrder.MonthFirst) {
      month = p1;
      day = p2;
    } else {
      day = p1;
      month = p2;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const cleanTime = stripBidi(rawTime).trim();
    const timeMatch = cleanTime.match(
      /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(?:([apAP]\.?[mM]\.?)|([صم])))?/,
    );
    if (!timeMatch || timeMatch[1] === undefined || timeMatch[2] === undefined) return null;

    let hours = Number.parseInt(timeMatch[1], 10);
    const minutes = Number.parseInt(timeMatch[2], 10);
    const seconds = timeMatch[3] !== undefined ? Number.parseInt(timeMatch[3], 10) : 0;
    const latinAmPm = timeMatch[4]?.toLowerCase().replace(/\./g, "");
    const arabicAmPm = timeMatch[5];

    const isPm = latinAmPm === "pm" || arabicAmPm === "م";
    const isAm = latinAmPm === "am" || arabicAmPm === "ص";

    if (isPm && hours < 12) hours += 12;
    if (isAm && hours === 12) hours = 0;

    const pad = (n: number) => n.toString().padStart(2, "0");
    const padYear = (n: number) => n.toString().padStart(4, "0");

    const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
    if (Number.isNaN(date.getTime())) return null;

    return `${padYear(year)}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}.000Z`;
  } catch {
    return null;
  }
}
