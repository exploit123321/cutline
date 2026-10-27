import type { Studio } from "../model/types";
import { PREFIX } from "./extract";
import { resolveSpeaker, slug, norm } from "./text";

/*
 * Who is in the script. Read in code before anything is classified: a script written for
 * Alex, Jamie and Sam cannot be cast onto Anna, Mārtiņš and Laura, and every speaker
 * would come back unknown. Plain text rules, no AI.
 */

/** Capitalised words that start sentences or name things, never people. */
const NOT_NAMES = new Set(
  [
    "maybe", "could", "would", "need", "needs", "then", "also", "camera", "cam", "screen", "note", "notes", "gfx", "cue",
    "music", "cut", "open", "close", "back", "wide", "medium", "the", "a", "an", "this", "that", "it", "we", "they", "he",
    "she", "you", "i", "something", "everyone", "nobody", "somebody", "someone", "perhaps", "actually", "okay", "yeah",
    "instead", "like", "for", "and", "but", "or", "so", "if", "when", "while", "return", "switch", "important", "overall",
  ].map(norm),
);

/** "Jamie could say", "Alex asks", "Sam could jump in with" */
const SAYS = /\b([A-Z][\p{L}'’-]+)\s+(?:could |would |might |then |also )?(?:say|says|said|ask|asks|reply|replies|respond|responds|jump in with|jumps in with|interrupt|interrupts)\b/gu;

/**
 * Speaker names in order of first appearance. A name counts when it starts a line as a
 * speaker prefix ("ALEX:", "M:", "Jamie —"), when a verb of speech and quoted words follow
 * it ("Jamie could say “…”"), or when it appears twice before a verb of speech.
 */
export function detectCast(text: string): string[] {
  const seen = new Map<string, { name: string; first: number; prefix: number; says: number }>();
  const note = (raw: string, at: number, kind: "prefix" | "says") => {
    const name = raw.trim().replace(/\.$/, "");
    const key = norm(name);
    // a single letter is a speaker only as a prefix ("M:"), never in running text
    if (!key || NOT_NAMES.has(key) || (key.length < 2 && kind !== "prefix")) return;
    const e = seen.get(key) ?? { name: name[0]?.toUpperCase() + name.slice(1).toLowerCase(), first: at, prefix: 0, says: 0 };
    e[kind]++;
    seen.set(key, e);
  };
  let offset = 0;
  for (const line of text.split(/\r?\n/)) {
    const m = PREFIX.exec(line.trim());
    if (m && !/^\[/.test(line.trim())) {
      const name = m[1] ?? "";
      // one word only: "Camera 1 on Alex" is not a speaker called "Camera 1"
      if (!/\s/.test(name)) note(name, offset, "prefix");
    }
    for (const s of line.matchAll(SAYS)) {
      const after = line.slice((s.index ?? 0) + s[0].length);
      // quoted words right after the verb make it as sure as a prefix
      note(s[1] ?? "", offset + (s.index ?? 0), /^[^“"]{0,24}[“"]/.test(after) ? "prefix" : "says");
    }
    offset += line.length + 1;
  }
  return [...seen.values()]
    .filter((e) => e.prefix > 0 || e.says >= 2)
    .sort((a, b) => a.first - b.first)
    .map((e) => e.name);
}

/** Share of the names the studio's cast covers, 0..1 (1 when the script names nobody). */
export function castFit(studio: Studio, names: string[]): number {
  if (!names.length) return 1;
  return names.filter((n) => resolveSpeaker(n, studio) !== null).length / names.length;
}

export type CastChoice =
  | { kind: "keep" }
  | { kind: "switch"; studio: Studio }
  | { kind: "recast"; studio: Studio; names: string[] };

/**
 * Keep the studio when its cast covers the script; else switch to a known studio that
 * does; else put the script's names on the current seats, in order, so the set, cameras
 * and props stay and only the people are renamed.
 */
export function chooseCast(current: Studio, names: string[], known: Studio[]): CastChoice {
  if (castFit(current, names) >= 0.5) return { kind: "keep" };
  const best = known
    .filter((s) => s.id !== current.id)
    .map((s) => ({ s, fit: castFit(s, names) }))
    .sort((a, b) => b.fit - a.fit)[0];
  if (best && best.fit >= 0.75) return { kind: "switch", studio: best.s };
  const seats = names.slice(0, current.people.length);
  if (!seats.length) return { kind: "keep" };
  const people = current.people.map((p, i) => {
    const name = seats[i];
    return name ? { ...p, id: slug(name) || p.id, name, aliases: [name], role: undefined } : p;
  });
  return { kind: "recast", studio: { ...current, id: `${current.id}+cast`, people }, names: seats };
}
