import { REVIEW_THRESHOLD } from "../model/constants";
import type { Row, RowType, Shot } from "../model/types";

export type Edit =
  | { field: "type"; value: RowType }
  | { field: "speakerId"; value: string | null }
  | { field: "shot"; value: Shot | null }
  | { field: "text"; value: string }
  | { field: "cameraId"; value: string }
  | { field: "duration"; value: number };

/**
 * A human edit. The row becomes locked, the edited field counts as confirmed
 * (confidence 1, no longer invalid), and review status is recomputed.
 */
export function applyEdit(row: Row, edit: Edit): Row {
  const next: Row = { ...row, locked: true, confidence: { ...row.confidence }, invalid: [...row.invalid] };
  switch (edit.field) {
    case "type":
    case "speakerId":
    case "shot":
      (next as Record<string, unknown>)[edit.field] = edit.value;
      next.confidence[edit.field] = 1;
      next.invalid = next.invalid.filter((f) => f !== edit.field);
      break;
    case "text":
      next.text = edit.value;
      break;
    case "cameraId":
      next.cameraId = edit.value;
      next.fov = null; // let the engine frame the shot for the new camera
      break;
    case "duration":
      next.duration = Math.max(0, edit.value);
      break;
  }
  next.needsReview = next.invalid.length > 0 || Object.values(next.confidence).some((c) => c < REVIEW_THRESHOLD);
  return next;
}
