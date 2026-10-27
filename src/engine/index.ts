import { headPosition, lineSide } from "../geometry";
import { MIN_HOLD } from "../model/constants";
import type { Person, Row, Shot, Show, Studio, Vec3 } from "../model/types";
import type { Aim } from "../geometry";
import {
  baseDuration,
  chooseShot,
  fallback,
  frame,
  isCandidate,
  mayCrossLine,
  rank,
  respectsLine,
  score,
  type Framing,
  type LineRule,
} from "./rules";

export * from "./rules";

/** One on-air shot: consecutive rows on the same camera and framing. */
export type ShotBlock = {
  cameraId: string;
  fov: number;
  shot: Shot;
  aim: Aim;
  target: Vec3;
  subjectIds: string[];
  start: number;
  duration: number;
  rowIds: string[];
};

/** `shots` holds the shot size the engine used for each row id, including rule-2 defaults. */
export type Plan = { rows: Row[]; blocks: ShotBlock[]; shots: Record<string, Shot> };

type Decision = { framing: Framing; shot: Shot; subjects: Person[] };

const first = (p: Person) => p.name.split(" ")[0] ?? p.name;
const cap = (s: string) => s[0]?.toUpperCase() + s.slice(1);

function subjectLabel(subjects: Person[], studio: Studio): string {
  if (subjects.length === studio.people.length && subjects.length > 1) return "the set";
  return subjects.map(first).join(" & ");
}

/** Tracks the last two distinct speakers and which side of their line the exchange uses. */
class Exchange {
  private speakers: string[] = [];
  private lastCameraOf = new Map<string, string>();
  private line: LineRule | null = null;

  constructor(private studio: Studio) {}

  /** Called before a row is cut, so the row is shot under the right exchange. */
  enter(row: Row): void {
    if (row.type !== "dialogue" || !row.speakerId) return;
    const id = row.speakerId;
    if (this.speakers.at(-1) === id) return;
    const before = [...this.speakers].sort().join("|");
    this.speakers = [...this.speakers.filter((s) => s !== id), id].slice(-2);
    if (this.speakers.length < 2 || [...this.speakers].sort().join("|") === before) return;
    const [a, b] = this.speakers.map((sid) => this.person(sid)) as [Person, Person];
    // the exchange opened on A's last shot, so that camera fixes the side
    this.line = { a, b, side: this.sideOf(this.lastCameraOf.get(a.id), a, b) };
  }

  /** After a row is cut: remember the camera, and fix the side if it is still open. */
  record(row: Row, cameraId: string): void {
    if (row.type === "dialogue" && row.speakerId) this.lastCameraOf.set(row.speakerId, cameraId);
    if (this.line && this.line.side === 0) {
      this.line = { ...this.line, side: this.sideOf(cameraId, this.line.a, this.line.b) };
    }
  }

  /** The active constraint; null until two people have spoken and a side is known. */
  active(): LineRule | null {
    return this.line && this.line.side !== 0 ? this.line : null;
  }

  private sideOf(cameraId: string | undefined, a: Person, b: Person): -1 | 0 | 1 {
    const cam = cameraId ? this.studio.cameras.find((c) => c.id === cameraId) : undefined;
    return cam ? lineSide(a.position, b.position, cam.position) : 0;
  }

  private person(id: string): Person {
    const p = this.studio.people.find((x) => x.id === id);
    if (!p) throw new Error(`unknown person ${id}`);
    return p;
  }
}

/** "article | Night buses carry…" → "article". Plain graphics text is shortened instead. */
function screenTitle(text: string): string {
  const head = text.split("|")[0]?.trim() ?? "";
  return head.length > 28 ? `${head.slice(0, 27)}…` : head || "graphics";
}

/**
 * The cut engine. Deterministic: plain functions of the show, no randomness, no AI.
 * Returns every row with camera, FOV, timing and a reason, plus the shot blocks the
 * timeline and program monitor play.
 */
export function planShow(show: Show): Plan {
  const { studio } = show;
  const exchange = new Exchange(studio);
  const out: Row[] = [];
  const decisions: Decision[] = [];
  let prev: { cameraId: string | null; shot: Shot | null } = { cameraId: null, shot: null };
  let clock = 0;
  // a shared screen on air: talk rides on it until a cut or cue takes the program back
  let screen: { decision: Decision; title: string } | null = null;

  for (const row of show.rows) {
    exchange.enter(row);
    if (row.type === "cut" || row.type === "cue") screen = null;
    const intent = chooseShot(row, studio);
    const line = exchange.active();
    const duration = row.locked && row.duration !== null ? row.duration : baseDuration(row);
    const lastDecision = decisions.at(-1);
    let decision: Decision;
    let reason: string;
    let needsReview = row.needsReview;

    const lockedCamera = row.locked && row.cameraId ? studio.cameras.find((c) => c.id === row.cameraId) : undefined;

    if (lockedCamera) {
      // Rule 1: a human chose this camera
      const f = frame(lockedCamera, intent.subjects, intent.shot);
      decision = { framing: row.fov !== null ? { ...f, fov: row.fov } : f, shot: intent.shot, subjects: intent.subjects };
      reason = `Locked by user · ${lockedCamera.label}`;
      if (line && !respectsLine(lockedCamera, line)) reason += ` · crosses the ${first(line.a)}–${first(line.b)} line`;
    } else if (screen && row.type === "dialogue") {
      // Screen segment: the screen stays on air with the people in the corner, so no cut
      decision = screen.decision;
      const speaker = studio.people.find((p) => p.id === row.speakerId);
      reason = `On screen: ${screen.title} · ${speaker ? first(speaker) : "talk"} in the corner box`;
    } else if (lastDecision && (row.type === "note" || (duration < MIN_HOLD && row.type !== "cut"))) {
      // Rule 7: too short to cut to (or not on air), so it rides on the previous shot
      decision = lastDecision;
      reason =
        row.type === "note"
          ? `Crew note, not on air · holds ${decision.framing.camera.label}`
          : `${duration.toFixed(1)} s is under the ${MIN_HOLD} s minimum hold · stays on ${decision.framing.camera.label}`;
    } else {
      const crossing = mayCrossLine(row, intent.shot);
      const lineRule = crossing ? null : line;
      const scored = studio.cameras
        .map((camera) => frame(camera, intent.subjects, intent.shot))
        .filter((f) => isCandidate(f, intent.shot) && respectsLine(f.camera, lineRule))
        .map((framing) => ({ framing, score: score(framing, intent.shot, prev) }));
      const best = rank(scored)[0];
      if (best) {
        const f = best.framing;
        decision = { framing: f, shot: intent.shot, subjects: intent.subjects };
        const parts = [
          `${cap(intent.shot)} on ${subjectLabel(intent.subjects, studio)}`,
          intent.shot === "wide" ? `${f.camera.label} sees everyone` : `${f.camera.label} ${Math.round(f.frontality)}° off face`,
        ];
        if (!intent.requested) parts.push(`${row.type ?? "untyped"} → ${intent.shot}`);
        if (lineRule) parts.push(`holds ${first(lineRule.a)}–${first(lineRule.b)} line`);
        if (crossing && line) parts.push("crosses the line as written");
        if (f.clamped) parts.push("lens at its limit");
        if (prev.cameraId === f.camera.id && prev.shot === intent.shot) parts.push("no better angle, repeats");
        reason = parts.join(" · ");
      } else {
        // Rule 6
        const f = fallback(studio);
        decision = { framing: f, shot: "wide", subjects: studio.people };
        reason = `No camera can take ${intent.shot} on ${subjectLabel(intent.subjects, studio)} · fallback to widest, ${f.camera.label}`;
        needsReview = true;
      }
    }

    const cameraId = decision.framing.camera.id;
    if (row.type === "visual") screen = { decision, title: screenTitle(row.text) };
    exchange.record(row, cameraId);
    if (row.type !== "note") prev = { cameraId, shot: decision.shot };
    decisions.push(decision);
    out.push({
      ...row,
      cameraId,
      fov: decision.framing.fov,
      start: clock,
      duration,
      reason,
      needsReview,
    });
    clock += duration;
  }

  const shots = Object.fromEntries(out.map((r, i) => [r.id, (decisions[i] as Decision).shot]));
  return { rows: out, blocks: toBlocks(out, decisions), shots };
}

export function runEngine(show: Show): Row[] {
  return planShow(show).rows;
}

function toBlocks(rows: Row[], decisions: Decision[]): ShotBlock[] {
  const blocks: ShotBlock[] = [];
  rows.forEach((row, i) => {
    const d = decisions[i];
    if (!d || row.duration === null || row.start === null) return;
    const last = blocks.at(-1);
    const same = last && last.cameraId === d.framing.camera.id && Math.abs(last.fov - d.framing.fov) < 1e-6 && last.shot === d.shot;
    if (last && (same || row.duration === 0)) {
      last.duration += row.duration;
      last.rowIds.push(row.id);
      return;
    }
    blocks.push({
      cameraId: d.framing.camera.id,
      fov: d.framing.fov,
      shot: d.shot,
      aim: d.framing.aim,
      target: d.framing.target,
      subjectIds: d.subjects.map((p) => p.id),
      start: row.start,
      duration: row.duration,
      rowIds: [row.id],
    });
  });
  return blocks;
}

/** Head positions are re-exported for the preview's lower label. */
export { headPosition };
