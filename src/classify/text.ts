import type { Person, Shot, Studio } from "../model/types";

/** Lowercase and strip diacritics so "Mārtiņš" matches "martins". */
export function norm(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function slug(s: string): string {
  return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Every string a person may be called, normalised, with whether it is a short (ambiguous) alias. */
function namesOf(p: Person): { key: string; short: boolean }[] {
  const raw = [p.id, p.name, ...p.name.split(/\s+/), ...p.aliases];
  return raw.map((r) => {
    const key = norm(r).replace(/\.$/, "");
    return { key, short: key.length <= 2 };
  });
}

/**
 * Resolve a speaker prefix ("ANNA", "M", "Mārtiņš") to a person.
 * Short aliases like "M" are allowed here because a prefix is unambiguous in position,
 * but they score lower.
 */
export function resolveSpeaker(name: string, studio: Studio): { id: string; confidence: number } | null {
  const key = norm(name).replace(/\.$/, "");
  for (const p of studio.people) {
    for (const n of namesOf(p)) {
      if (n.key === key) return { id: p.id, confidence: n.short ? 0.8 : 0.95 };
    }
  }
  return null;
}

/**
 * First person mentioned anywhere in the text. Short aliases are skipped: "a" or "m"
 * would match ordinary words.
 */
export function firstMention(text: string, studio: Studio): { id: string; at: number } | null {
  const hay = norm(text);
  let best: { id: string; at: number } | null = null;
  for (const p of studio.people) {
    for (const n of namesOf(p)) {
      if (n.short) continue;
      const re = new RegExp(`(^|[^a-z0-9])${n.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`);
      const m = re.exec(hay);
      if (m && (best === null || m.index < best.at)) best = { id: p.id, at: m.index };
    }
  }
  return best;
}

/** Shot size explicitly asked for in the text, if any. */
export function explicitShot(text: string): Shot | null {
  const t = norm(text);
  if (/\b(close[- ]?up|close (on|shot)|cu|tight)\b/.test(t)) return "close";
  if (/\b(medium|mid[- ]?shot|ms)\b/.test(t)) return "medium";
  if (/\b(wide|ws|establishing)\b/.test(t)) return "wide";
  return null;
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
