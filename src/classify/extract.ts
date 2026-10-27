/** "ANNA: …", "LAURA - …", "Anna — …": a short name, then a colon or a spaced dash. */
export const PREFIX = /^([\p{L}][\p{L}.'’]*(?:\s[\p{L}][\p{L}.'’]*){0,2})\s*(?::|\s[-—–]\s)\s*(.*)$/u;
const CONTINUES = /^(she|he|they)\s+(continues|goes on|adds|carries on)\b[:,]?\s*/i;

/**
 * The line text without its speaker prefix or brackets. Deterministic, because Jev only
 * decides and cannot return text. "[GFX: chart]" → "chart", "ANNA: hi" → "hi".
 */
export function extractText(segment: string): string {
  const s = segment.trim();
  const bracket = /^\[(.*)\]$/.exec(s);
  if (bracket) {
    const body = (bracket[1] ?? "").trim();
    const colon = body.indexOf(":");
    return (colon >= 0 ? body.slice(colon + 1) : body).trim() || body;
  }
  const cont = CONTINUES.exec(s);
  if (cont) return s.slice(cont[0].length).trim() || s;
  const prefix = PREFIX.exec(s);
  if (prefix) return (prefix[2] ?? "").trim() || s;
  return s;
}
