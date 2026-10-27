import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { classifyAll } from "../../src/classify/loop";
import { mockClassifyOne } from "../../src/classify/mock";
import { segment } from "../../src/classify/segment";
import { planShow, type Plan, type ShotBlock } from "../../src/engine";
import { lookAngles, headPosition } from "../../src/geometry";
import { talkshow } from "../../src/fixtures/studios";
import {
  blockIndexAt,
  buildPerformance,
  camerasAt,
  exchangeAt,
  lerpAngle,
  MOVE_TIME,
  peopleAt,
  SETTLE_TIME,
  strapAt,
  wallAt,
} from "../../src/show";
import { alice, bob, tiny } from "../geometry/fixture";
import { row, words } from "../engine/helpers";

const sample = readFileSync(new URL("../../src/fixtures/rundowns/talkshow-01.txt", import.meta.url), "utf8");
const samplePlan = async () => planShow({ studio: talkshow, rows: await classifyAll(segment(sample), talkshow, mockClassifyOne) });

/** A two-person exchange in the tiny studio: Alice, Bob, Alice, each 4 s. */
const exchange = (): Plan =>
  planShow({
    studio: tiny,
    rows: [row("dialogue", "a", words(10)), row("dialogue", "b", words(10)), row("dialogue", "a", words(10))],
  });

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

describe("lerpAngle", () => {
  it("goes the short way round across ±180°", () => {
    expect(lerpAngle(170, -170, 0.5)).toBeCloseTo(180);
    expect(lerpAngle(-170, 170, 0.5)).toBeCloseTo(-180);
    expect(lerpAngle(10, 30, 0.25)).toBeCloseTo(15);
  });
});

describe("camerasAt", () => {
  it("puts exactly one camera on program, at the block's aim and FOV", async () => {
    const plan = await samplePlan();
    for (const b of plan.blocks) {
      const t = b.start + b.duration / 2;
      const s = camerasAt(plan, talkshow, t);
      const pgm = Object.entries(s.states).filter(([, c]) => c.status === "pgm");
      expect(pgm.map(([id]) => id)).toEqual([b.cameraId]);
    }
  });

  it("marks the next different camera as preview", () => {
    const plan = exchange();
    const [b0, b1] = plan.blocks as [ShotBlock, ShotBlock];
    expect(b0.cameraId).not.toBe(b1.cameraId);
    const s = camerasAt(plan, tiny, b0.start + 0.1);
    expect(s.pvw).toBe(b1.cameraId);
    expect(s.states[b1.cameraId]?.status).toBe("pvw");
  });

  it("has an off-air camera framed on its next shot before the cut", () => {
    const plan = exchange();
    const b1 = plan.blocks[1] as ShotBlock;
    const s = camerasAt(plan, tiny, b1.start - SETTLE_TIME / 2);
    const cam = s.states[b1.cameraId];
    expect(cam?.status).toBe("pvw");
    expect(close(cam?.aim.yaw ?? NaN, b1.aim.yaw)).toBe(true);
    expect(close(cam?.fov ?? NaN, b1.fov)).toBe(true);
  });

  it("starts the move no earlier than MOVE_TIME before the cut", () => {
    const plan = exchange();
    const b2 = plan.blocks[2] as ShotBlock;
    // camera of b2 was on air for b0; before its move window it still holds b0's aim
    const b0 = plan.blocks[0] as ShotBlock;
    expect(b2.cameraId).toBe(b0.cameraId);
    const early = b2.start - SETTLE_TIME - MOVE_TIME - 0.01;
    if (early > b0.start + b0.duration) {
      const s = camerasAt(plan, tiny, early);
      expect(close(s.states[b2.cameraId]?.aim.yaw ?? NaN, b0.aim.yaw)).toBe(true);
    }
  });

  it("never moves a fixed camera", async () => {
    const plan = await samplePlan();
    const fixed = talkshow.cameras.filter((c) => c.fixed);
    expect(fixed.length).toBeGreaterThan(0);
    const end = (plan.blocks.at(-1) as ShotBlock).start + (plan.blocks.at(-1) as ShotBlock).duration;
    for (let t = 0; t < end; t += 0.37) {
      const s = camerasAt(plan, talkshow, t);
      for (const c of fixed) {
        expect(s.states[c.id]?.aim).toEqual({ yaw: c.yaw, pitch: c.pitch });
      }
    }
  });

  it("is a pure function of t", async () => {
    const plan = await samplePlan();
    expect(JSON.stringify(camerasAt(plan, talkshow, 7.3))).toBe(JSON.stringify(camerasAt(plan, talkshow, 7.3)));
  });

  it("keeps every camera idle when there is no plan", () => {
    const s = camerasAt({ rows: [], blocks: [], shots: {} }, tiny, 0);
    expect(Object.values(s.states).every((c) => c.status === "idle")).toBe(true);
    expect(blockIndexAt({ rows: [], blocks: [], shots: {} }, 3)).toBe(-1);
  });
});

describe("peopleAt", () => {
  it("has the speaker talk and look at the other person in an exchange", () => {
    const plan = exchange();
    const perf = buildPerformance(plan, tiny);
    const b1 = plan.blocks[1] as ShotBlock;
    const s = peopleAt(perf, tiny, b1.start + 1);
    expect(s.b?.talking).toBe(true);
    expect(s.a?.talking).toBe(false);
    expect(s.b?.lookAt).toBe("a");
    expect(s.a?.lookAt).toBe("b");
    // after the head turn the gaze points straight at the other head
    const want = lookAngles(headPosition(alice), headPosition(bob));
    expect(s.a?.gaze.yaw).toBeCloseTo(want.yaw);
  });

  it("has the first speaker address the camera when nobody spoke before", () => {
    const plan = exchange();
    const s = peopleAt(buildPerformance(plan, tiny), tiny, 1);
    expect(s.a?.lookAt).toBe("camera");
  });

  it("reads laughs, nods and turns from the row text", async () => {
    const plan = await samplePlan();
    const perf = buildPerformance(plan, talkshow);
    const at = (raw: string) => {
      const r = plan.rows.find((x) => x.raw === raw);
      if (!r || r.start === null || r.duration === null) throw new Error(raw);
      return r.start + r.duration / 2;
    };
    expect(peopleAt(perf, talkshow, at("Laura laughs")).laura?.act).toBe("laugh");
    expect(peopleAt(perf, talkshow, at("back to anna, she nods")).anna?.act).toBe("nod");
    expect(peopleAt(perf, talkshow, at("Anna turns to Mārtiņš")).anna?.lookAt).toBe("martins");
  });

  it("tracks the active 180° pair and each person's first line", async () => {
    const plan = await samplePlan();
    const perf = buildPerformance(plan, talkshow);
    const m = plan.rows.find((r) => r.raw.startsWith("M:"));
    if (!m || m.start === null) throw new Error("no M row");
    expect(exchangeAt(perf, m.start + 0.5)).toEqual(["anna", "martins"]);
    expect(exchangeAt(perf, 0)).toBeNull();
    expect(strapAt(perf, m.start + 0.5)).toBe("martins");
  });
});

describe("wallAt", () => {
  it("shows graphics during a visual row and the logo otherwise", async () => {
    const plan = await samplePlan();
    const gfx = plan.rows.find((r) => r.type === "visual");
    if (!gfx || gfx.start === null) throw new Error("no visual row");
    expect(wallAt(plan, gfx.start + 0.1)).toEqual({ kind: "gfx", text: gfx.text, fullScreen: true });
    expect(wallAt(plan, 0).kind).toBe("logo");
  });
});
