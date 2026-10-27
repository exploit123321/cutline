import type { Row, Studio } from "../model/types";

/**
 * What a provider returns for one segment. Untrusted: it may come from an LLM,
 * so every field is checked by `validate()` before it becomes a Row.
 */
export type RawClassification = {
  type: unknown;
  speakerId: unknown;
  text: unknown;
  shot: unknown;
  confidence: unknown;
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

export type ProviderId = "mock" | "llm";
