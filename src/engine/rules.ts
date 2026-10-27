import {
  aimAt,
  centroid,
  clampFov,
  distance,
  frontality,
  groupHeight,
  headPosition,
  idealFov,
  inView,
  lineSide,
  type Aim,
} from "../geometry";
import { explicitShot } from "../classify/text";
import {
  DEFAULT_DURATION,
  DIALOGUE_MIN_DURATION,
  MAX_FRONTALITY,
  WORDS_PER_SECOND,
} from "../model/constants";
import type { Camera, Person, Row, Shot, Studio, Vec3 } from "../model/types";
import { wordCount } from "../classify/text";

export type ShotIntent = {
  shot: Shot;
  subjects: Person[];
  /** true when the row (or its text) asked for this size; false when rule 2 picked it */
  requested: boolean;
};

/** Rule 2: what to frame and how tight. */
export function chooseShot(row: Row, studio: Studio): ShotIntent {
  const speaker = row.speakerId ? studio.people.find((p) => p.id === row.speakerId) : undefined;
  const fromText = row.type === "cut" ? explicitShot(row.text) : null;
  const requested = row.shot ?? fromText;
  let shot: Shot;
  if (requested) shot = requested;
  else if (!speaker) shot = "wide";
  else if (row.type === "dialogue" || row.type === "cut") shot = "medium";
  else shot = "wide"; // action, visual, cue, note
  // a wide frames the whole set; tighter shots frame the speaker
  const subjects = shot !== "wide" && speaker ? [speaker] : studio.people;
  return { shot, subjects, requested: Boolean(requested) };
}

export type Framing = {
  camera: Camera;
  fov: number;
  clamped: boolean;
  visible: boolean;
  frontality: number;
  aim: Aim;
  target: Vec3;
};

/** How a given camera would frame these subjects at this shot size. */
export function frame(camera: Camera, subjects: Person[], shot: Shot): Framing {
  const heads = subjects.map(headPosition);
  const target = centroid(heads);
  const gh = shot === "wide" ? groupHeight(camera, heads) : 0;
  const ideal = idealFov(distance(camera.position, target), shot, gh);
  const fov = clampFov(camera, ideal);
  const visible = heads.every((h) => inView(camera, h, fov, target));
  const front = subjects.reduce((sum, p) => sum + frontality(p, camera), 0) / Math.max(subjects.length, 1);
  return { camera, fov, clamped: Math.abs(fov - ideal) > 1e-9, visible, frontality: front, aim: aimAt(camera, target), target };
}

/** Rule 3: the subject is in view, and close/medium shots see the face. */
export function isCandidate(f: Framing, shot: Shot): boolean {
  return f.visible && (shot === "wide" || f.frontality <= MAX_FRONTALITY);
}

export type LineRule = { a: Person; b: Person; side: -1 | 0 | 1 };

/** Rule 4: a camera may not sit on the far side of the A–B line (cameras on the line are fine). */
export function respectsLine(camera: Camera, line: LineRule | null): boolean {
  if (!line || line.side === 0) return true;
  return lineSide(line.a.position, line.b.position, camera.position) !== -line.side;
}

const CROSS_TEXT = /\b(cross(es|ing)? the line|reverse|other side)\b/i;

/** Rule 4 exception: a wide cut or cue may cross only when its text says so. */
export function mayCrossLine(row: Row, shot: Shot): boolean {
  return shot === "wide" && (row.type === "cut" || row.type === "cue") && CROSS_TEXT.test(row.text);
}

/** Rule 5. Higher is better. */
export function score(f: Framing, shot: Shot, previous: { cameraId: string | null; shot: Shot | null }): number {
  const shotMatch = f.clamped ? 0 : 1;
  const sameAsPrevious = previous.cameraId === f.camera.id && previous.shot === shot ? 1 : 0;
  return 1.0 * (1 - f.frontality / 90) + 0.3 * shotMatch - 1.0 * sameAsPrevious;
}

/** Sort by score, ties by camera id, so the same input always gives the same pick. */
export function rank<T extends { score: number; framing: Framing }>(scored: T[]): T[] {
  return [...scored].sort((x, y) => {
    if (Math.abs(x.score - y.score) > 1e-9) return y.score - x.score;
    return x.framing.camera.id < y.framing.camera.id ? -1 : 1;
  });
}

/**
 * Rule 6: the widest camera that sees everyone, framing the whole set. If none sees
 * everyone, the one that sees the most people.
 */
export function fallback(studio: Studio): Framing {
  const heads = studio.people.map(headPosition);
  const target = centroid(heads);
  const options = studio.cameras.map((camera) => {
    const fov = camera.fovRange[1];
    const seen = heads.filter((h) => inView(camera, h, fov, target)).length;
    return { camera, fov, seen };
  });
  options.sort((x, y) => y.seen - x.seen || y.fov - x.fov || (x.camera.id < y.camera.id ? -1 : 1));
  const best = options[0];
  if (!best) throw new Error("studio has no cameras");
  const f = frame(best.camera, studio.people, "wide");
  return { ...f, fov: best.fov, clamped: true, visible: best.seen === heads.length };
}

/** Rule 7: base duration of a row before merging. */
export function baseDuration(row: Row): number {
  if (row.type === "note") return 0; // crew notes are not on air
  if (row.type === "dialogue") return Math.max(DIALOGUE_MIN_DURATION, wordCount(row.text) / WORDS_PER_SECOND);
  return DEFAULT_DURATION;
}
