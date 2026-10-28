import { TypeSafeClient, type SystemOneRequest } from "@typesafe-ai/sdk";
import { z } from "zod";
import { extractText, quotedText } from "../src/classify/extract";
import type { RawClassification } from "../src/classify/types";
import { JEV_USD_PER_MTOK, UNKNOWN_SPEAKER_THRESHOLD } from "../src/model/constants";
import type { ConfidenceField } from "../src/model/types";
import type { ClassifyRequest } from "./prompt";
import {
  ADVICE_NO,
  ADVICE_YES,
  jevQuestions,
  jevState,
  MOMENT_YES,
  MOMENTS,
  NEW_SCREEN_NO,
  NEW_SCREEN_YES,
  NO_PERSON,
  NO_SHOT,
  QUOTE_YES,
  UNSURE,
} from "./jev-questions";

/** Pinned, so thresholds tuned on one version do not move when the alias does. */
export const DEFAULT_JEV_MODEL = "jev-1.14.0";

export function jevModel(): string {
  return process.env.TYPESAFE_DEFAULT_MODEL || DEFAULT_JEV_MODEL;
}

export function hasJevKey(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY);
}

/** One call to the API. Returns the parsed JSON body, unchecked; tests pass a stub. */
export type SystemOne = (req: SystemOneRequest) => Promise<unknown>;

let client: TypeSafeClient | null = null;
function defaultSystemOne(req: SystemOneRequest): Promise<unknown> {
  // the spec allows one retry at most; the SDK default is two
  client ??= new TypeSafeClient({ retry: { maxRetries: 1 }, timeout: 15_000 });
  return client.systemOne(req);
}

const ChoiceAnswer = z.object({
  type: z.literal("choice"),
  choice: z.string(),
  confidence: z.number().min(0).max(1),
  probabilities: z.record(z.string(), z.number()),
});
const NoulAnswer = z.object({ type: z.literal("noul"), noul: z.number().min(0).max(1) });
const Response = z.object({
  model: z.string(),
  answers: z.record(z.string(), z.unknown()),
  usage: z.object({ input_tokens: z.number().nullable() }).partial().optional(),
});

/**
 * The on-air beat that a "note" really is, from the yes/no questions in MOMENTS: briefs
 * word their moments as suggestions ("maybe start wide"), and `type` often calls those
 * notes. The surer answer wins. Null when no answer is sure, or none is valid.
 */
function onAirBeat(answers: Record<string, unknown>): { type: string; p: number } | null {
  const hits = MOMENTS.flatMap(([q, type]) => {
    const a = NoulAnswer.safeParse(answers[q]);
    return a.success && a.data.noul > MOMENT_YES ? [{ type, p: a.data.noul }] : [];
  });
  return hits.sort((a, b) => b.p - a.p)[0] ?? null;
}

/**
 * One segment in, one classification out. Each answer is checked on its own, so a
 * missing or malformed answer fails only its field. An HTTP error throws, and the
 * classify loop turns that into a fully flagged row (never a silent "no").
 */
export async function jevClassifySegment(req: ClassifyRequest, systemOne: SystemOne = defaultSystemOne): Promise<RawClassification> {
  const t0 = performance.now();
  const body = await systemOne({
    model: jevModel(),
    state: jevState(req.segment, req.context, req.studio, req.onScreen ?? null),
    questions: jevQuestions(req.studio),
  });
  const ms = Math.round(performance.now() - t0);
  const res = Response.parse(body);

  const failed: ConfidenceField[] = [];
  const pick = (name: string, field: ConfidenceField) => {
    const a = ChoiceAnswer.safeParse(res.answers[name]);
    if (!a.success) failed.push(field);
    return a.success ? a.data : null;
  };
  const type = pick("type", "type");
  const shot = pick("shot", "shot");

  // The truth table for briefs: Jev judges, code decides.
  //   general advice             > ADVICE_YES      → note (off air; quotes in it are examples)
  //   quoted words for the cast  > QUOTE_YES       → dialogue, the text is the quoted words
  //   type note, but asks for a shot or shows
  //   a reaction                 > MOMENT_YES      → cut or action (the surer one), flagged
  //   type visual, a screen is on air,
  //   and something new comes up < NEW_SCREEN_NO   → note (a detail of that screen), flagged
  //                     NEW_SCREEN_NO..NEW_SCREEN_YES → visual, flagged
  //   general advice    ADVICE_NO..ADVICE_YES      → Jev's type, flagged for review
  //   otherwise                                    → Jev's type
  const quote = NoulAnswer.safeParse(res.answers.quote_is_line);
  const advice = NoulAnswer.safeParse(res.answers.general_advice);
  const quoted = quotedText(req.segment);
  let rowType: string | null = type?.choice ?? null;
  let typeConfidence = type?.confidence ?? 0;
  let text = extractText(req.segment);
  if (advice.success && advice.data.noul > ADVICE_YES) {
    rowType = "note";
    typeConfidence = advice.data.noul;
  } else if (quote.success && quote.data.noul > QUOTE_YES && quoted) {
    rowType = "dialogue";
    typeConfidence = quote.data.noul;
    text = quoted;
  } else {
    const beat = rowType === "note" ? onAirBeat(res.answers) : null;
    // two of Jev's answers disagree, so a human checks the row
    if (beat) [rowType, typeConfidence] = [beat.type, Math.min(beat.p, UNSURE)];
    const fresh = NoulAnswer.safeParse(res.answers.new_screen);
    if (rowType === "visual" && req.onScreen && fresh.success && fresh.data.noul <= NEW_SCREEN_YES) {
      if (fresh.data.noul < NEW_SCREEN_NO) rowType = "note";
      typeConfidence = Math.min(typeConfidence, UNSURE);
    }
    if (advice.success && advice.data.noul >= ADVICE_NO) typeConfidence = Math.min(typeConfidence, UNSURE);
  }

  // Dialogue takes who says the words; every other row takes who it shows or describes.
  // Only the answer that is used can fail the field.
  const speaker = pick(rowType === "dialogue" ? "speaks" : "subject", "speakerId");
  const unknown = NoulAnswer.safeParse(res.answers.unknown_speaker);
  // a cast list that does not cover the speaker is a red flag, not a "nobody"
  if (unknown.success && unknown.data.noul > UNKNOWN_SPEAKER_THRESHOLD && !failed.includes("speakerId")) {
    failed.push("speakerId");
  }

  const inputTokens = res.usage?.input_tokens ?? null;
  return {
    type: rowType,
    speakerId: !speaker || speaker.choice === NO_PERSON ? null : speaker.choice,
    text,
    shot: !shot || shot.choice === NO_SHOT ? null : shot.choice,
    confidence: { type: typeConfidence, speakerId: speaker?.confidence ?? 0, shot: shot?.confidence ?? 0 },
    failed,
    meta: {
      ms,
      model: res.model,
      inputTokens,
      costUsd: inputTokens === null ? null : (inputTokens * JEV_USD_PER_MTOK) / 1e6,
    },
  };
}
