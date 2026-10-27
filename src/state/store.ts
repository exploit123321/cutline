import { create } from "zustand";
import { segment, type ProviderId } from "../classify";
import { classifyAll } from "../classify/loop";
import { llmAvailable, llmClassifyOne } from "../classify/llm";
import { mockClassifyOne } from "../classify/mock";
import type { ClassifyOne } from "../classify/types";
import { planShow, type Plan, type ShotBlock } from "../engine";
import { talkshow } from "../fixtures/studios";
import sample from "../fixtures/rundowns/talkshow-01.txt?raw";
import type { Row, Studio } from "../model/types";
import { applyEdit, type Edit } from "./edit";

export type Drag = { kind: "person" | "camera"; id: string } | null;

type State = {
  studio: Studio;
  script: string;
  provider: ProviderId;
  llmReady: boolean | null;
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

  setScript: (s: string) => void;
  loadSample: () => void;
  setProvider: (p: ProviderId) => void;
  checkLlm: () => Promise<void>;
  parse: () => Promise<void>;
  edit: (rowId: string, e: Edit) => void;
  setReviewOnly: (v: boolean) => void;
  setTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setDrag: (d: Drag) => void;
  move: (kind: "person" | "camera", id: string, x: number, z: number) => void;
};

const plan = (studio: Studio, rows: Row[]) => planShow({ studio, rows });
const ONE: Record<ProviderId, ClassifyOne> = { mock: mockClassifyOne, llm: llmClassifyOne };

export const useStore = create<State>()((set, get) => ({
  studio: talkshow,
  script: "",
  provider: "mock",
  llmReady: null,
  rows: [],
  plan: { rows: [], blocks: [], shots: {} },
  parsing: null,
  error: null,
  reviewOnly: false,
  time: 0,
  playing: false,
  drag: null,

  setScript: (script) => set({ script }),
  loadSample: () => set({ script: sample }),
  setProvider: (provider) => set({ provider }),
  checkLlm: async () => set({ llmReady: await llmAvailable() }),

  parse: async () => {
    const { script, studio, provider, rows: previous } = get();
    const segments = segment(script);
    set({ parsing: { done: 0, total: segments.length }, error: null, playing: false });
    let done = 0;
    // same loop as the Classifier interface, wrapped to report progress per call
    const counted: ClassifyOne = async (input) => {
      try {
        return await ONE[provider](input);
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
        error: failed && provider === "llm" ? `${failed} segment(s) could not be classified. Is the server running with a key?` : null,
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
