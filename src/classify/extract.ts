/** "ANNA: …", "LAURA - …", "Anna — …": a short name, then a colon or a spaced dash. */
export const PREFIX = /^([\p{L}][\p{L}.'’]*(?:\s[\p{L}][\p{L}.'’]*){0,2})\s*(?::|\s[-—–]\s)\s*(.*)$/u;
const CONTINUES = /^(she|he|they)\s+(continues|goes on|adds|carries on)\b[:,]?\s*/i;

/** Text inside curly, straight or angle quotes. */
const QUOTED = /[“"„«]([^”"“»]+)[”"»]/g;
/** A whole line wrapped in one pair of quotes. */
const WRAPPED = /^[“"„«]([^”"“»]*)[”"»]$/;

/** “Hello.” → Hello. Lines in a script are often written in quotes; the screen shows the words. */
export function unquote(text: string): string {
  return WRAPPED.exec(text)?.[1]?.trim() ?? text;
}

/**
 * The line text without its speaker prefix, brackets or wrapping quotes. Deterministic,
 * because Jev only decides and cannot return text. "[GFX: chart]" → "chart",
 * "ANNA: hi" → "hi", "Alex: “So…”" → "So…".
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
  if (cont) return unquote(s.slice(cont[0].length).trim()) || s;
  const prefix = PREFIX.exec(s);
  if (prefix) return unquote((prefix[2] ?? "").trim()) || s;
  return unquote(s);
}

/**
 * The quoted words in a line, joined, or null when there are none:
 * "Jamie could say “Can we pull that up?” and then…" → "Can we pull that up?".
 * Used when Jev says the quotes are words a cast member says on air.
 */
export function quotedText(segment: string): string | null {
  const spans = [...segment.matchAll(QUOTED)].map((m) => (m[1] ?? "").trim().replace(/[,;]$/, "")).filter(Boolean);
  return spans.length ? spans.join(" ") : null;
}
