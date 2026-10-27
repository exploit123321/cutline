import type { ConfidenceField, Row, Studio } from "../model/types";

/** Cost and speed of one provider call, shown in the footer and summed by `npm run eval`. */
export type CallMeta = {
  ms: number;
  model?: string;
  inputTokens?: number | null;
  /** null when the provider does not report a price */
  costUsd?: number | null;
};

/**
 * What a provider returns for one segment. Untrusted: it may come from a model,
 * so every field is checked by `validate()` before it becomes a Row.
 */
export type RawClassification = {
  type: unknown;
  speakerId: unknown;
  text: unknown;
  shot: unknown;
  confidence: unknown;
  /** fields the provider itself could not decide (missing or malformed answer, unknown speaker) */
  failed?: unknown;
  meta?: CallMeta;
};

/** The previous rows a provider sees, trimmed to what matters for continuity. */
export type ContextRow = Pick<Row, "type" | "speakerId" | "text" | "shot">;

export type ClassifyOne = (input: {
  segment: string;
  context: ContextRow[];
  studio: Studio;
}) => Promise<RawClassification>;

export interface Classifier {
  classify(input: { segments: string[]; studio: Studio; previous?: Row[] }): Promise<Row[]>;
}

export type ProviderId = "mock" | "jev" | "llm";
export type ServerProvider = Exclude<ProviderId, "mock">;
export const CONFIDENCE_FIELDS: ConfidenceField[] = ["type", "speakerId", "shot"];
