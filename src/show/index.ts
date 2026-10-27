import { firstMention } from "../classify/text";
import type { Plan, ShotBlock } from "../engine";
import { aimAt, centroid, headPosition, lookAngles, type Aim } from "../geometry";
import type { Person, Row, Studio, Vec3 } from "../model/types";

export * from "./screen";
import { screenContent } from "./screen";

/*
 * What the show looks like at time t: where each camera points, which one is on air,
 * who talks and where everyone looks. Pure functions of (plan, studio, t), so scrubbing
 * back and forth always gives the same picture. Visual only: the engine has already
 * decided every cut, and nothing here changes it.
 */

/** An operated camera off air pans to its next shot over this many seconds… */
export const MOVE_TIME = 1.6;
/** …and is framed this long before the cut, so the cut lands on a still picture. */
export const SETTLE_TIME = 0.25;
/** Consecutive blocks on one camera: the operator reframes on air over this time. */
export const REFRAME_TIME = 0.6;
/** A head turns to a new target over this time. */
export const GAZE_TIME = 0.45;

export const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Interpolate angles in degrees along the shorter way round. */
export function lerpAngle(a: number, b: number, p: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * p;
}

const lerpAim = (a: Aim, b: Aim, p: number): Aim => ({ yaw: lerpAngle(a.yaw, b.yaw, p), pitch: lerp(a.pitch, b.pitch, p) });

export function blockIndexAt(plan: Plan, t: number): number {
  const { blocks } = plan;
  if (!blocks.length) return -1;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i] as ShotBlock;
    if (t >= b.start && t < b.start + b.duration) return i;
  }
  return t < (blocks[0] as ShotBlock).start ? 0 : blocks.length - 1;
}

// ---------- Cameras ----------

export type CamStatus = "pgm" | "pvw" | "idle";
export type CamState = {
  status: CamStatus;
  aim: Aim;
  fov: number;
  /** seconds on air in the current run of shots, null when off air */
  onAir: number | null;
  /** 0 while still, up to 1 while the operator pans or zooms */
  moving: number;
};

/** Where an idle operated camera rests: on the middle of the set. */
function restAim(studio: Studio, cameraId: string): Aim {
  const cam = studio.cameras.find((c) => c.id === cameraId);
  if (!cam) return { yaw: 0, pitch: 0 };
  return aimAt(cam, centroid(studio.people.map(headPosition)));
}

/** A slow camera move written in the rundown: +1 pushes in, -1 zooms out, 0 holds. */
export function moveOf(plan: Plan, block: ShotBlock): -1 | 0 | 1 {
  const text = plan.rows
    .filter((r) => block.rowIds.includes(r.id))
    .map((r) => r.text.toLowerCase())
    .join(" ");
  if (/\b(push(es)? in|move in|moves in|zoom in|creep in)\b/.test(text)) return 1;
  if (/\b(zoom out|zooms out|pull (out|back)|pull wide)\b/.test(text)) return -1;
  return 0;
}

/** How far a push-in tightens, and a zoom-out widens, the FOV over the shot. */
export const PUSH_IN = 0.22;
export const ZOOM_OUT = 0.3;

export type ShowCameras = {
  states: Record<string, CamState>;
  pgm: string | null;
  pvw: string | null;
  block: ShotBlock | null;
  next: ShotBlock | null;
};

export function camerasAt(plan: Plan, studio: Studio, t: number): ShowCameras {
  const { blocks } = plan;
  const cur = blockIndexAt(plan, t);
  const block = cur >= 0 ? (blocks[cur] as ShotBlock) : null;
  const nextIdx = block ? blocks.findIndex((b, i) => i > cur && b.cameraId !== block.cameraId) : -1;
  const next = nextIdx >= 0 ? (blocks[nextIdx] as ShotBlock) : null;
  const states: Record<string, CamState> = {};

  for (const cam of studio.cameras) {
    const rest = { aim: restAim(studio, cam.id), fov: (cam.fovRange[0] + cam.fovRange[1]) / 2 };
    if (!block) {
      states[cam.id] = { status: "idle", ...rest, onAir: null, moving: 0 };
      continue;
    }
    if (block.cameraId === cam.id) {
      const prev = blocks[cur - 1];
      const reframe = prev && prev.cameraId === cam.id ? smooth((t - block.start) / REFRAME_TIME) : 1;
      let runStart = block.start;
      for (let i = cur - 1; i >= 0 && blocks[i]?.cameraId === cam.id; i--) runStart = (blocks[i] as ShotBlock).start;
      // a written move ("slow push in") runs over the whole shot, inside the lens range
      const move = moveOf(plan, block);
      const p = smooth((t - block.start) / Math.max(block.duration, 1e-6));
      const k = move > 0 ? 1 - PUSH_IN * p : move < 0 ? 1 + ZOOM_OUT * p : 1;
      const base = prev && reframe < 1 ? lerp(prev.fov, block.fov, reframe) : block.fov;
      states[cam.id] = {
        status: "pgm",
        aim: prev && reframe < 1 ? lerpAim(prev.aim, block.aim, reframe) : block.aim,
        fov: Math.min(cam.fovRange[1], Math.max(cam.fovRange[0], base * k)),
        onAir: Math.max(0, t - runStart),
        moving: reframe < 1 || (move !== 0 && p > 0 && p < 1) ? 1 : 0,
      };
      continue;
    }
    // off air: hold the last shot, then move to the next one before it is cut to
    let prevIdx = -1;
    for (let i = cur; i >= 0; i--) if (blocks[i]?.cameraId === cam.id) { prevIdx = i; break; }
    const ownNext = blocks.findIndex((b, i) => i > cur && b.cameraId === cam.id);
    const from = prevIdx >= 0 ? (blocks[prevIdx] as ShotBlock) : rest;
    const offAir = prevIdx >= 0 ? (blocks[prevIdx] as ShotBlock).start + (blocks[prevIdx] as ShotBlock).duration : 0;
    let aim = from.aim;
    let fov = from.fov;
    let moving = 0;
    if (ownNext >= 0) {
      const to = blocks[ownNext] as ShotBlock;
      const w1 = to.start - SETTLE_TIME;
      const w0 = Math.max(offAir, w1 - MOVE_TIME);
      const p = w1 <= w0 ? (t >= w0 ? 1 : 0) : smooth((t - w0) / (w1 - w0));
      aim = lerpAim(from.aim, to.aim, p);
      fov = lerp(from.fov, to.fov, p);
      moving = p > 0 && p < 1 ? 1 : 0;
    }
    states[cam.id] = { status: next?.cameraId === cam.id ? "pvw" : "idle", aim, fov, onAir: null, moving };
  }
  return { states, pgm: block?.cameraId ?? null, pvw: next?.cameraId ?? null, block, next };
}

// ---------- People ----------

export type Act = "laugh" | "nod" | null;

/** One on-air row, seen from one person. */
type Beat = {
  start: number;
  end: number;
  talking: boolean;
  /** a person id, "camera", or null for their default facing */
  lookAt: string | null;
  target: Vec3 | null;
  act: Act;
};

export type Performance = {
  beats: Record<string, Beat[]>;
  /** the last two distinct speakers, from the moment the second one starts */
  exchanges: { start: number; pair: [string, string] }[];
  /** each person's first line, for the name strap */
  firstLines: Record<string, { start: number; end: number }>;
  /** when each name strap is on screen */
  straps: StrapWindow[];
};

const onAir = (r: Row) => r.start !== null && r.duration !== null && r.duration > 0;

function actOf(text: string): Act {
  if (/\blaugh/i.test(text)) return "laugh";
  if (/\bnod/i.test(text)) return "nod";
  return null;
}

/** "Anna turns to Mārtiņš" → martins. Looks only after "turns to", so the subject is not matched. */
function turnTarget(text: string, studio: Studio, self: string): string | null {
  const m = /\bturns?\s+(?:to|towards)\b(.*)$/i.exec(text);
  if (!m) return null;
  const who = firstMention(m[1] ?? "", studio);
  return who && who.id !== self ? who.id : null;
}

/** Build the performance once per plan; `peopleAt` then reads it at any t. */
export function buildPerformance(plan: Plan, studio: Studio): Performance {
  const beats: Record<string, Beat[]> = Object.fromEntries(studio.people.map((p) => [p.id, []]));
  const exchanges: Performance["exchanges"] = [];
  const firstLines: Performance["firstLines"] = {};
  const heads = new Map(studio.people.map((p) => [p.id, headPosition(p)]));
  const turned = new Map<string, string>();
  let speakers: string[] = [];

  for (const r of plan.rows.filter(onAir)) {
    const start = r.start as number;
    const end = start + (r.duration as number);
    const speaker = r.type === "dialogue" && r.speakerId && heads.has(r.speakerId) ? r.speakerId : null;
    if (speaker) {
      turned.delete(speaker);
      if (speakers.at(-1) !== speaker) {
        speakers = [...speakers.filter((s) => s !== speaker), speaker].slice(-2);
        if (speakers.length === 2) exchanges.push({ start, pair: [speakers[0] as string, speaker] });
      }
      firstLines[speaker] ??= { start, end };
    }
    if (r.speakerId && heads.has(r.speakerId)) {
      const to = turnTarget(r.text, studio, r.speakerId);
      if (to) turned.set(r.speakerId, to);
    }
    const lastSpeaker = speakers.at(-1) ?? null;
    const block = plan.blocks.find((b) => start >= b.start && start < b.start + b.duration);
    const liveCam = studio.cameras.find((c) => c.id === block?.cameraId);

    for (const p of studio.people) {
      const talking = speaker === p.id;
      let lookAt: string | null = null;
      if (talking) {
        const named = firstMention(r.text, studio);
        const partner = speakers.find((s) => s !== p.id);
        lookAt = named && named.id !== p.id ? named.id : partner ?? "camera";
      } else if (turned.has(p.id)) {
        lookAt = turned.get(p.id) as string;
      } else if (speaker) {
        lookAt = speaker;
      } else if (lastSpeaker && lastSpeaker !== p.id) {
        lookAt = lastSpeaker;
      } else if (lastSpeaker === p.id) {
        lookAt = speakers.find((s) => s !== p.id) ?? null;
      }
      const target = lookAt === "camera" ? (liveCam?.position ?? null) : lookAt ? (heads.get(lookAt) ?? null) : null;
      const act = r.speakerId === p.id ? actOf(r.text) : null;
      (beats[p.id] as Beat[]).push({ start, end, talking, lookAt, target, act });
    }
  }
  return { beats, exchanges, firstLines, straps: strapWindows(plan, firstLines) };
}

export type PersonState = {
  talking: boolean;
  lookAt: string | null;
  /** world yaw and pitch of the gaze, in degrees */
  gaze: Aim;
  act: Act;
  /** 0..1 through the current beat */
  phase: number;
};

function gazeOf(head: Vec3, facingYaw: number, target: Vec3 | null): Aim {
  return target ? lookAngles(head, target) : { yaw: facingYaw, pitch: 0 };
}

export function personAt(perf: Performance, p: Person, t: number): PersonState {
  const list = perf.beats[p.id] ?? [];
  const head = headPosition(p);
  let i = -1;
  for (let k = 0; k < list.length; k++) if ((list[k] as Beat).start <= t) i = k;
  const beat = list[i];
  if (!beat) return { talking: false, lookAt: null, gaze: gazeOf(head, p.facingYaw, null), act: null, phase: 0 };
  const prev = list[i - 1];
  const now = gazeOf(head, p.facingYaw, beat.target);
  const before = prev ? gazeOf(head, p.facingYaw, prev.target) : now;
  const g = smooth((t - beat.start) / GAZE_TIME);
  const inBeat = t < beat.end;
  return {
    talking: beat.talking && inBeat,
    lookAt: beat.lookAt,
    gaze: lerpAim(before, now, g),
    act: inBeat ? beat.act : null,
    phase: Math.min(1, Math.max(0, (t - beat.start) / Math.max(beat.end - beat.start, 1e-6))),
  };
}

export function peopleAt(perf: Performance, studio: Studio, t: number): Record<string, PersonState> {
  return Object.fromEntries(studio.people.map((p) => [p.id, personAt(perf, p, t)]));
}

/** The two people whose 180° line is active at t, if any. */
export function exchangeAt(perf: Performance, t: number): [string, string] | null {
  let pair: [string, string] | null = null;
  for (const e of perf.exchanges) if (e.start <= t) pair = e.pair;
  return pair;
}

/** A name strap (lower-third) stays up at least this long… */
export const STRAP_MIN = 3;
/** …then leaves on the first cut or new phrase, and at the latest after this long. */
export const STRAP_MAX = 7;
/** How long the strap takes to wipe on, and off when it does not leave on a cut. */
export const STRAP_WIPE = 0.45;

export type StrapWindow = {
  personId: string;
  start: number;
  end: number;
  /** cut: it goes out with the cut; phrase: its wipe ends as the next subtitle cue starts */
  out: "cut" | "phrase" | "time";
};

export type Strap = {
  personId: string;
  /** 0..1: wiping on */
  enter: number;
  /** 0..1: wiping off (1 = fully gone) */
  exit: number;
};

/** Every time a camera change goes to air. A reframe on the same camera is not a cut. */
export function cutTimes(plan: Plan): number[] {
  return plan.blocks.filter((b, i) => i > 0 && plan.blocks[i - 1]?.cameraId !== b.cameraId).map((b) => b.start);
}

/** Every time the words change: each row on air starts and ends, and each subtitle cue starts. */
export function phraseTimes(plan: Plan): number[] {
  const times: number[] = [];
  for (const r of plan.rows.filter(onAir)) {
    const start = r.start as number;
    const dur = r.duration as number;
    times.push(start, start + dur);
    if (r.type !== "dialogue") continue;
    const words = subtitleChunks(r.text).map((c) => c.split(/\s+/).length);
    const total = words.reduce((a, b) => a + b, 0);
    let acc = 0;
    for (const w of words.slice(0, -1)) times.push(start + ((acc += w) / total) * dur);
  }
  return [...new Set(times)].sort((a, b) => a - b);
}

/**
 * One strap per person, on their first line. It stays STRAP_MIN, then leaves with the
 * first cut or phrase change, so it never goes out in the middle of a shot and a phrase.
 */
export function strapWindows(plan: Plan, firstLines: Performance["firstLines"]): StrapWindow[] {
  const cuts = cutTimes(plan);
  const phrases = phraseTimes(plan);
  const lines = Object.entries(firstLines).sort((a, b) => a[1].start - b[1].start);
  return lines.map(([personId, line], i) => {
    const from = line.start + STRAP_MIN;
    const latest = Math.min(line.start + STRAP_MAX, lines[i + 1]?.[1].start ?? Infinity);
    const first = (ts: number[]) => ts.find((x) => x >= from - 1e-9 && x <= latest + 1e-9);
    const cut = first(cuts);
    const phrase = first(phrases);
    // a cut and a phrase change at the same moment go out on the cut
    if (cut !== undefined && (phrase === undefined || cut <= phrase + 1e-9)) return { personId, start: line.start, end: cut, out: "cut" };
    if (phrase !== undefined) return { personId, start: line.start, end: phrase, out: "phrase" };
    return { personId, start: line.start, end: latest, out: "time" };
  });
}

/**
 * The lower-third on screen at t, with how far it has wiped on and off. Timed from the
 * playhead, not a CSS timer, so a scrub or a recorded frame shows the same strap.
 */
export function strapAt(perf: Performance, t: number): Strap | null {
  const w = perf.straps.find((s) => t >= s.start && t < s.end);
  if (!w) return null;
  return {
    personId: w.personId,
    enter: smooth((t - w.start) / STRAP_WIPE),
    // on a cut the strap goes out with the picture; otherwise its wipe ends on the boundary
    exit: w.out === "cut" ? 0 : 1 - smooth((w.end - t) / STRAP_WIPE),
  };
}

// ---------- Screens ----------

export type WallContent = { kind: "logo" } | { kind: "gfx"; text: string; fullScreen: boolean };

/** What the set's video wall (and, for full-screen graphics, the program output) shows. */
export function wallAt(plan: Plan, t: number): WallContent {
  const r = plan.rows.find((x) => onAir(x) && t >= (x.start as number) && t < (x.start as number) + (x.duration as number));
  // the wall shows the screen's title, not the rundown's "kind | title | items" line
  if (r?.type === "visual") return { kind: "gfx", text: screenContent(r.text).title, fullScreen: /full[\s-]?screen|\bfs\b/i.test(r.text) };
  return { kind: "logo" };
}

// ---------- Subtitles ----------

/** Broadcast subtitle limits: two lines of at most 42 characters on screen at once. */
export const SUB_LINE = 42;
export const SUB_LINES = 2;

export type Subtitle = {
  speakerId: string | null;
  text: string;
  /** stable per cue, so the UI can animate a change */
  key: string;
};

/** Sentence case for the screen: rundowns are often typed in lower case. */
function sentenceCase(text: string): string {
  return text.replace(/(^\s*|[.!?]\s+)(\p{Ll})/gu, (_, gap: string, ch: string) => gap + ch.toUpperCase());
}

/**
 * Split a line into on-screen cues that fit SUB_LINES × SUB_LINE characters.
 * A cue ends early at a sentence end once it holds at least a third of the space.
 */
export function subtitleChunks(text: string, max = SUB_LINE * SUB_LINES): string[] {
  const words = sentenceCase(text.trim()).split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && next.length > max) {
      chunks.push(cur);
      cur = w;
    } else {
      cur = next;
    }
    if (/[.!?]$/.test(cur) && cur.length >= max / 3) {
      chunks.push(cur);
      cur = "";
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/** The subtitle on screen at t: the cue of the dialogue line on air, timed by its share of the words. */
export function subtitleAt(plan: Plan, t: number): Subtitle | null {
  const r = plan.rows.find((x) => onAir(x) && t >= (x.start as number) && t < (x.start as number) + (x.duration as number));
  if (!r || r.type !== "dialogue" || !r.text.trim()) return null;
  const chunks = subtitleChunks(r.text);
  const weights = chunks.map((c) => c.split(/\s+/).length);
  const total = weights.reduce((a, b) => a + b, 0);
  const progress = ((t - (r.start as number)) / (r.duration as number)) * total;
  let acc = 0;
  let i = 0;
  while (i < chunks.length - 1 && progress >= acc + (weights[i] as number)) acc += weights[i++] as number;
  return { speakerId: r.speakerId, text: chunks[i] as string, key: `${r.id}:${i}` };
}
