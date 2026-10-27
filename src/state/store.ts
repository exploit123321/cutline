import { create } from "zustand";
import { segment, type ProviderId } from "../classify";
import { classifyAll } from "../classify/loop";
import { remoteClassifyOne, serverHealth, type ServerHealth } from "../classify/remote";
import { mockClassifyOne } from "../classify/mock";
import type { CallMeta, ClassifyOne } from "../classify/types";
import { planShow, type Plan, type ShotBlock } from "../engine";
import { talkshow } from "../fixtures/studios";
import sample from "../fixtures/rundowns/talkshow-01.txt?raw";
import type { Row, Studio } from "../model/types";
import { applyEdit, type Edit } from "./edit";

export type Drag = { kind: "person" | "camera"; id: string } | null;
export type Mode = "plan" | "show";

type State = {
  studio: Studio;
  script: string;
  provider: ProviderId;
  /** which server providers have a key; null until the first check */
  health: ServerHealth | null;
  /** speed and cost of the last parse, for the footer */
  stats: { calls: number; totalMs: number; lastMs: number; costUsd: number | null; model: string | null } | null;
  /** classifier output plus human edits; the engine reads this */
  rows: Row[];
  /** engine output; the UI reads this */
  plan: Plan;
  parsing: { done: number; total: number } | null;
  error: string | null;
  reviewOnly: boolean;
  time: number;
  playing: boolean;
  drag: Drag;
  /** plan: script, sheet and preview; show: the full-screen show with every camera live */
  mode: Mode;
  speed: number;

  setScript: (s: string) => void;
  loadSample: () => void;
  setProvider: (p: ProviderId) => void;
  checkServer: () => Promise<void>;
  parse: () => Promise<void>;
  edit: (rowId: string, e: Edit) => void;
  setReviewOnly: (v: boolean) => void;
  setTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setDrag: (d: Drag) => void;
  setMode: (m: Mode) => void;
  setSpeed: (s: number) => void;
  /** jump to the start of the next (+1) or previous (-1) shot */
  stepShot: (dir: 1 | -1) => void;
  move: (kind: "person" | "camera", id: string, x: number, z: number) => void;
};

const plan = (studio: Studio, rows: Row[]) => planShow({ studio, rows });
const ONE: Record<ProviderId, ClassifyOne> = {
  mock: mockClassifyOne,
  jev: remoteClassifyOne("jev"),
  llm: remoteClassifyOne("llm"),
};

function addMeta(stats: NonNullable<State["stats"]>, m: CallMeta | undefined): NonNullable<State["stats"]> {
  if (!m) return stats;
  const cost = m.costUsd === undefined || m.costUsd === null ? stats.costUsd : (stats.costUsd ?? 0) + m.costUsd;
  return { calls: stats.calls + 1, totalMs: stats.totalMs + m.ms, lastMs: m.ms, costUsd: cost, model: m.model ?? stats.model };
}

export const useStore = create<State>()((set, get) => ({
  studio: talkshow,
  script: "",
  provider: "mock",
  health: null,
  stats: null,
  rows: [],
  plan: { rows: [], blocks: [], shots: {} },
  parsing: null,
  error: null,
  reviewOnly: false,
  time: 0,
  playing: false,
  drag: null,
  mode: "plan",
  speed: 1,

  setScript: (script) => set({ script }),
  loadSample: () => set({ script: sample }),
  setProvider: (provider) => set({ provider }),
  checkServer: async () => {
    const health = await serverHealth();
    // Jev is the default whenever the server has its key; mock keeps the app working without one
    set((s) => ({ health, provider: s.health === null && health.jev ? "jev" : s.provider }));
  },

  parse: async () => {
    const { script, studio, provider, rows: previous } = get();
    const segments = segment(script);
    set({ parsing: { done: 0, total: segments.length }, error: null, playing: false });
    let stats: NonNullable<State["stats"]> = { calls: 0, totalMs: 0, lastMs: 0, costUsd: null, model: null };
    let done = 0;
    // same loop as the Classifier interface, wrapped to report progress per call
    const counted: ClassifyOne = async (input) => {
      try {
        const raw = await ONE[provider](input);
        stats = addMeta(stats, raw.meta);
        return raw;
      } finally {
        set({ parsing: { done: ++done, total: segments.length } });
      }
    };
    try {
      const rows = await classifyAll(segments, studio, counted, previous);
      const failed = rows.filter((r) => r.invalid.length === 3).length;
      set({
        rows,
        plan: plan(studio, rows),
        time: 0,
        stats: stats.calls ? stats : null,
        error: failed && provider !== "mock" ? `${failed} segment(s) could not be classified. Is the server running with a key?` : null,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ parsing: null });
    }
  },

  edit: (rowId, e) => {
    const { rows, studio } = get();
    const next = rows.map((r) => (r.id === rowId ? applyEdit(r, e) : r));
    set({ rows: next, plan: plan(studio, next) });
  },

  setReviewOnly: (reviewOnly) => set({ reviewOnly }),
  setTime: (time) => set({ time }),
  setPlaying: (playing) => {
    const { time, plan: p } = get();
    const end = totalDuration(p);
    set({ playing, time: playing && time >= end ? 0 : time });
  },
  setDrag: (drag) => set({ drag }),
  setMode: (mode) => set({ mode }),
  setSpeed: (speed) => set({ speed }),
  stepShot: (dir) => {
    const { plan: p, time } = get();
    if (!p.blocks.length) return;
    const starts = p.blocks.map((b) => b.start);
    // a small margin, so "previous" from just after a cut goes to the shot before it
    const target =
      dir > 0 ? starts.find((s) => s > time + 1e-6) : [...starts].reverse().find((s) => s < time - 0.25);
    set({ time: target ?? (dir > 0 ? totalDuration(p) : 0) });
  },

  move: (kind, id, x, z) => {
    const { studio, rows } = get();
    const next: Studio =
      kind === "person"
        ? { ...studio, people: studio.people.map((p) => (p.id === id ? { ...p, position: { ...p.position, x, z } } : p)) }
        : { ...studio, cameras: studio.cameras.map((c) => (c.id === id ? { ...c, position: { ...c.position, x, z } } : c)) };
    set({ studio: next, plan: plan(next, rows) });
  },
}));

export function totalDuration(p: Plan): number {
  const last = p.blocks.at(-1);
  return last ? last.start + last.duration : 0;
}

export function blockAt(p: Plan, t: number): ShotBlock | null {
  if (!p.blocks.length) return null;
  for (const b of p.blocks) if (t >= b.start && t < b.start + b.duration) return b;
  return p.blocks.at(-1) ?? null;
}

export function rowAt(p: Plan, t: number): Row | null {
  let hit: Row | null = null;
  for (const r of p.rows) {
    if (r.start === null || r.duration === null || r.duration === 0) continue;
    if (t >= r.start) hit = r;
  }
  return hit;
}
