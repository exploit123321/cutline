import { REVIEW_THRESHOLD } from "../model/constants";
import { ROW_TYPES, SHOTS } from "../model/schema";
import type { ConfidenceField, Row, RowType, Shot, Studio } from "../model/types";
import type { RawClassification } from "./types";

type Classified = Pick<Row, "type" | "speakerId" | "text" | "shot" | "confidence" | "needsReview" | "invalid">;

function unit(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/**
 * Turn an untrusted classification into row fields. An invalid field becomes null with
 * confidence 0 and is listed in `invalid`; nothing is guessed or silently corrected.
 */
export function validate(raw: RawClassification, segment: string, studio: Studio): Classified {
  const conf = (raw.confidence ?? {}) as Record<string, unknown>;
  const confidence = { type: unit(conf.type), speakerId: unit(conf.speakerId), shot: unit(conf.shot) };
  const invalid: ConfidenceField[] = [];

  let type: RowType | null = null;
  if (typeof raw.type === "string" && (ROW_TYPES as readonly string[]).includes(raw.type)) {
    type = raw.type as RowType;
  } else {
    invalid.push("type");
    confidence.type = 0;
  }

  let speakerId: string | null = null;
  if (raw.speakerId === null || raw.speakerId === undefined) {
    speakerId = null;
  } else if (typeof raw.speakerId === "string" && studio.people.some((p) => p.id === raw.speakerId)) {
    speakerId = raw.speakerId;
  } else {
    invalid.push("speakerId");
    confidence.speakerId = 0;
  }

  let shot: Shot | null = null;
  if (raw.shot === null || raw.shot === undefined) {
    shot = null;
  } else if (typeof raw.shot === "string" && (SHOTS as readonly string[]).includes(raw.shot)) {
    shot = raw.shot as Shot;
  } else {
    invalid.push("shot");
    confidence.shot = 0;
  }

  const text = typeof raw.text === "string" && raw.text.trim() ? raw.text.trim() : segment;
  const needsReview = invalid.length > 0 || Object.values(confidence).some((c) => c < REVIEW_THRESHOLD);
  return { type, speakerId, text, shot, confidence, needsReview, invalid };
}

export function failedClassification(segment: string): Classified {
  return {
    type: null,
    speakerId: null,
    text: segment,
    shot: null,
    confidence: { type: 0, speakerId: 0, shot: 0 },
    needsReview: true,
    invalid: ["type", "speakerId", "shot"],
  };
}
