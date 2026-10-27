import type { RowType, Studio } from "../model/types";
import { PREFIX } from "./extract";
import { explicitShot, firstMention, norm, resolveSpeaker, slug } from "./text";
import type { ClassifyOne, ContextRow, RawClassification } from "./types";

const TAGS: [RegExp, RowType][] = [
  [/^(gfx|graphic|graphics|lower third|strap|vt|video|fullscreen|full screen|ots)$/, "visual"],
  [/^(cue|sfx|music|break|bumper|sting|stinger|titles|applause|audio)$/, "cue"],
  [/^(cut|cam|camera)$/, "cut"],
  [/^(note|notes|nb|producer|prod)$/, "note"],
];

const CUT_START = /^((cut|back|go|over|switch)\s+to\b|(close|tight|wide|medium|two[- ]shot)\s+on\b|cam(era)?\s*\d|push in|pull (out|back))/;
const CUE_START = /^(open|opening|close show|closing|music|sfx|stinger|bumper|roll|break|titles|applause|lights)\b/;
const CONTINUES = /^(she|he|they)\s+(continues|goes on|adds|carries on)\b[:,]?\s*/;

function tagType(tag: string): RowType | null {
  const t = norm(tag);
  for (const [re, type] of TAGS) if (re.test(t)) return type;
  return null;
}

function result(
  type: RowType,
  speakerId: string | null,
  text: string,
  conf: { type: number; speakerId: number },
): RawClassification {
  const shot = explicitShot(text);
  // no shot request in the text is a confident "none", not a guess
  return { type, speakerId, text, shot, confidence: { ...conf, shot: shot ? 0.9 : 1 } };
}

function lastSpeaker(context: ContextRow[]): string | null {
  for (let i = context.length - 1; i >= 0; i--) {
    const r = context[i];
    if (r && r.type === "dialogue" && r.speakerId) return r.speakerId;
  }
  return null;
}

/**
 * Deterministic keyword classifier. No network. Good enough to drive the whole app
 * and to give the LLM provider a baseline in `npm run eval`.
 */
export function mockClassify(segment: string, context: ContextRow[], studio: Studio): RawClassification {
  const s = segment.trim();
  const lower = norm(s);

  // [GFX: chart] / [CUT TO WIDE] / [CUE: break bumper]
  const bracket = /^\[(.*)\]$/.exec(s);
  if (bracket) {
    const body = (bracket[1] ?? "").trim();
    const [tag, rest] = body.includes(":") ? [body.slice(0, body.indexOf(":")), body.slice(body.indexOf(":") + 1)] : ["", body];
    const type = tagType(tag) ?? (CUT_START.test(norm(body)) ? "cut" : CUE_START.test(norm(body)) ? "cue" : "note");
    const who = firstMention(body, studio);
    return result(type, who?.id ?? null, (rest || body).trim(), { type: tag ? 0.95 : 0.85, speakerId: 0.9 });
  }

  // "she continues: …" — speaker comes from context, which is a guess, so it scores low
  const cont = CONTINUES.exec(lower);
  if (cont) {
    return result("dialogue", lastSpeaker(context), s.slice(cont[0].length) || s, { type: 0.75, speakerId: 0.6 });
  }

  if (CUT_START.test(lower)) {
    return result("cut", firstMention(s, studio)?.id ?? null, s, { type: 0.9, speakerId: 0.9 });
  }
  if (CUE_START.test(lower)) {
    return result("cue", firstMention(s, studio)?.id ?? null, s, { type: 0.85, speakerId: 0.9 });
  }

  // "ANNA: …", "LAURA - …", "Anna — …"
  const prefix = PREFIX.exec(s);
  if (prefix) {
    const name = prefix[1] ?? "";
    const body = (prefix[2] ?? "").trim();
    const tagged = tagType(name);
    if (tagged) {
      return result(tagged, firstMention(body, studio)?.id ?? null, body, { type: 0.9, speakerId: 0.9 });
    }
    const who = resolveSpeaker(name, studio);
    // an unknown name is still clearly a speaker; pass it through so validation flags it
    return result("dialogue", who ? who.id : slug(name), body, { type: 0.95, speakerId: who ? who.confidence : 0.9 });
  }

  // "Laura laughs", "Anna turns to Mārtiņš"
  const who = firstMention(s, studio);
  if (who && who.at === 0) {
    return result("action", who.id, s, { type: 0.85, speakerId: 0.9 });
  }

  // a lowercase line right after dialogue reads as the same speaker going on
  const prev = context[context.length - 1];
  if (prev?.type === "dialogue" && /^[\p{Ll}]/u.test(s)) {
    return result("dialogue", prev.speakerId, s, { type: 0.6, speakerId: 0.6 });
  }

  return result("note", who?.id ?? null, s, { type: 0.5, speakerId: who ? 0.7 : 0.8 });
}

export const mockClassifyOne: ClassifyOne = async ({ segment, context, studio }) =>
  mockClassify(segment, context, studio);
