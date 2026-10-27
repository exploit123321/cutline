import { emptyEngineFields } from "../../src/classify/loop";
import type { Row, RowType, Shot } from "../../src/model/types";

let n = 0;
/** A clean, fully confident row for engine tests. */
export function row(type: RowType, speakerId: string | null, text: string, extra: Partial<Row> = {}): Row {
  const index = n++;
  return {
    id: `t${index}`,
    index,
    raw: text,
    type,
    speakerId,
    text,
    shot: null as Shot | null,
    confidence: { type: 1, speakerId: 1, shot: 1 },
    needsReview: false,
    invalid: [],
    locked: false,
    ...emptyEngineFields(),
    ...extra,
  };
}

export const words = (k: number) => Array.from({ length: k }, (_, i) => `w${i}`).join(" ");
