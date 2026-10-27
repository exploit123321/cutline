import type { Studio } from "../model/types";

/**
 * One colour per participant, in the subtitle tradition (yellow, cyan, pink, green…):
 * bright on black, and far from tally red and preview green.
 */
const COLOURS = ["#ffd60a", "#5ac8fa", "#ff8fb8", "#b4e86a", "#c7a9ff", "#ffb35c"];

export function speakerColour(studio: Studio, id: string | null): string {
  const i = studio.people.findIndex((p) => p.id === id);
  return i < 0 ? "#ececf2" : (COLOURS[i % COLOURS.length] as string);
}

export function firstName(studio: Studio, id: string | null): string | null {
  const p = studio.people.find((x) => x.id === id);
  return p ? (p.name.split(" ")[0] ?? p.name) : null;
}

/** The show's name, from the studio name: "Late Line — podcast set" → "Late Line". */
export function brandOf(studio: Studio): string {
  return studio.name.split(/\s+[—–-]\s+/)[0]?.trim() || studio.name;
}

/** "Late Line" → "LL" */
export function initials(brand: string): string {
  return brand
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 3)
    .toUpperCase();
}
