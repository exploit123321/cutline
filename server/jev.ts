import { TypeSafeClient, type SystemOneRequest } from "@typesafe-ai/sdk";
import { z } from "zod";
import { extractText, quotedText } from "../src/classify/extract";
import type { RawClassification } from "../src/classify/types";
import { JEV_USD_PER_MTOK, UNKNOWN_SPEAKER_THRESHOLD } from "../src/model/constants";
import type { ConfidenceField } from "../src/model/types";
import type { ClassifyRequest } from "./prompt";
import { ADVICE_NO, ADVICE_YES, jevQuestions, jevState, NO_PERSON, NO_SHOT, QUOTE_YES } from "./jev-questions";

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
 * One segment in, one classification out. Each answer is checked on its own, so a
 * missing or malformed answer fails only its field. An HTTP error throws, and the
 * classify loop turns that into a fully flagged row (never a silent "no").
 */
export async function jevClassifySegment(req: ClassifyRequest, systemOne: SystemOne = defaultSystemOne): Promise<RawClassification> {
  const t0 = performance.now();
  const body = await systemOne({
    model: jevModel(),
    state: jevState(req.segment, req.context, req.studio),
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
  //   quoted words for the cast  > QUOTE_YES       → dialogue, the text is the quoted words
  //   general advice             > ADVICE_YES      → note (off air)
  //   general advice    ADVICE_NO..ADVICE_YES      → Jev's type, flagged for review
  //   otherwise                                    → Jev's type
  const quote = NoulAnswer.safeParse(res.answers.quote_is_line);
  const advice = NoulAnswer.safeParse(res.answers.general_advice);
  const quoted = quotedText(req.segment);
  let rowType: string | null = type?.choice ?? null;
  let typeConfidence = type?.confidence ?? 0;
  let text = extractText(req.segment);
  if (quote.success && quote.data.noul > QUOTE_YES && quoted) {
    rowType = "dialogue";
    typeConfidence = quote.data.noul;
    text = quoted;
  } else if (advice.success && advice.data.noul > ADVICE_YES) {
    rowType = "note";
    typeConfidence = advice.data.noul;
  } else if (advice.success && advice.data.noul >= ADVICE_NO) {
    typeConfidence = Math.min(typeConfidence, 0.6);
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
