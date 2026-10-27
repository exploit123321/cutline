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
  strapWindows,
  STRAP_MAX,
  STRAP_MIN,
  cutTimes,
  phraseTimes,
  SUB_MAX,
  subtitleAt,
  subtitleChunks,
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
    expect(strapAt(perf, m.start + 1)).toEqual({ personId: "martins", enter: 1, exit: 0 });
    // wiping on at the start of the line
    const opening = strapAt(perf, m.start + 0.1);
    expect(opening?.enter).toBeGreaterThan(0);
    expect(opening?.enter).toBeLessThan(1);
  });
});

describe("wallAt", () => {
  it("shows graphics during a visual row and the logo otherwise", async () => {
    const plan = await samplePlan();
    const gfx = plan.rows.find((r) => r.type === "visual");
    if (!gfx || gfx.start === null) throw new Error("no visual row");
    expect(wallAt(plan, gfx.start + 0.1)).toEqual({ kind: "gfx", text: "Budget chart", fullScreen: true });
    expect(wallAt(plan, 0).kind).toBe("logo");
  });
});

describe("subtitles", () => {
  it("keeps every cue to one line of at most SUB_MAX characters", () => {
    const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    const chunks = subtitleChunks(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(SUB_MAX);
    expect(chunks.join(" ")).toBe(long.replace(/^w/, "W"));
  });

  it("breaks at a sentence end and puts the text in sentence case", () => {
    expect(subtitleChunks("Labvakar and welcome back to Evening Desk. tonight we have two guests")).toEqual([
      "Labvakar and welcome back to Evening Desk.",
      "Tonight we have two guests",
    ]);
    expect(subtitleChunks("not a disaster, a missed chance. look at the numbers")).toEqual([
      "Not a disaster, a missed chance.",
      "Look at the numbers",
    ]);
    // a short sentence stays with the next one instead of flashing up alone
    expect(subtitleChunks("yes. we know the numbers")).toEqual(["Yes. We know the numbers"]);
    expect(subtitleChunks("Okay, okay. Focus. Alex, go")).toEqual(["Okay, okay. Focus. Alex, go"]);
  });

  it("splits a long sentence into cues of about equal length, not a two-word orphan", () => {
    const chunks = subtitleChunks("Alright, welcome back everyone, we've got quite a bit to get through today");
    expect(chunks).toHaveLength(2);
    for (const c of chunks) expect(c.length).toBeGreaterThan(30);
    expect(chunks.join(" ")).toBe("Alright, welcome back everyone, we've got quite a bit to get through today");
  });

  it("shows the line on air with its speaker, and nothing between lines", async () => {
    const plan = await samplePlan();
    const m = plan.rows.find((r) => r.raw.startsWith("M:"));
    if (!m || m.start === null || m.duration === null) throw new Error("no M row");
    const s = subtitleAt(plan, m.start + 0.1);
    expect(s?.speakerId).toBe("martins");
    expect(s?.text.startsWith("Not a disaster")).toBe(true);
    expect(subtitleAt(plan, 0.5)).toBeNull(); // the opening cue has no dialogue
  });

  it("moves to the next cue as the line goes on", async () => {
    const plan = await samplePlan();
    const r = plan.rows.find((x) => x.raw.startsWith("ANNA: Labvakar"));
    if (!r || r.start === null || r.duration === null) throw new Error("no opening line");
    const first = subtitleAt(plan, r.start + 0.05);
    const last = subtitleAt(plan, r.start + r.duration - 0.05);
    expect(first?.text).toBe("Labvakar and welcome back to Evening Desk.");
    expect(last?.text).toBe("Tonight we have two guests");
    expect(first?.key).not.toBe(last?.key);
  });
});

describe("name strap timing", () => {
  it("stays at least STRAP_MIN and leaves on a cut or a phrase change", async () => {
    const plan = await samplePlan();
    const perf = buildPerformance(plan, talkshow);
    const cuts = cutTimes(plan);
    const phrases = phraseTimes(plan);
    expect(perf.straps.map((s) => s.personId)).toEqual(["anna", "martins", "laura"]);
    for (const s of perf.straps) {
      expect(s.end - s.start).toBeGreaterThanOrEqual(STRAP_MIN - 1e-9);
      expect(s.end - s.start).toBeLessThanOrEqual(STRAP_MAX + 1e-9);
      if (s.out === "cut") expect(cuts).toContain(s.end);
      if (s.out === "phrase") expect(phrases).toContain(s.end);
    }
  });

  it("goes out with the cut on Anna's opening, and wipes off into the graphic after Mārtiņš", async () => {
    const plan = await samplePlan();
    const [anna, martins] = buildPerformance(plan, talkshow).straps;
    // Anna 2.0–6.8 s: the cue change at 4.8 s is too early, the cut to CAM 2 at 6.8 s takes it out
    expect(anna).toMatchObject({ start: 2, end: 6.8, out: "cut" });
    // Mārtiņš 12.8 s: 16.8 s is a reframe on CAM 2, not a cut, so it leaves on the phrase change
    expect(martins).toMatchObject({ start: 12.8, end: 16.8, out: "phrase" });
  });

  it("is fully on until a cut, and wipes off before a phrase change", async () => {
    const plan = await samplePlan();
    const perf = buildPerformance(plan, talkshow);
    const [anna, martins] = perf.straps;
    if (!anna || !martins) throw new Error("straps missing");
    expect(strapAt(perf, anna.end - 0.01)?.exit).toBe(0);
    expect(strapAt(perf, anna.end)).toBeNull();
    expect(strapAt(perf, martins.end - 0.01)?.exit).toBeGreaterThan(0.95);
  });

  it("never leaves before STRAP_MIN even when a phrase ends sooner", () => {
    const plan = planShow({ studio: tiny, rows: [row("dialogue", "a", words(3)), row("dialogue", "a", words(20))] });
    const [s] = strapWindows(plan, buildPerformance(plan, tiny).firstLines);
    expect(s?.start).toBe(0);
    expect(s?.end).toBeGreaterThanOrEqual(STRAP_MIN);
  });
});

describe("written camera moves", () => {
  it("pushes in over the shot on 'slow push in', and zooms out on 'slow zoom out'", () => {
    const plan = planShow({
      studio: tiny,
      rows: [row("cue", null, "OPEN wide, slow push in"), row("dialogue", "a", words(10)), row("cue", null, "outro, slow zoom out")],
    });
    const [open, , outro] = plan.blocks;
    if (!open || !outro) throw new Error("blocks");
    const fovAt = (t: number) => camerasAt(plan, tiny, t).states[camerasAt(plan, tiny, t).pgm as string]?.fov ?? NaN;
    expect(fovAt(open.start + 0.01)).toBeCloseTo(open.fov, 1);
    expect(fovAt(open.start + open.duration - 0.01)).toBeLessThan(open.fov * 0.8);
    expect(fovAt(outro.start + outro.duration - 0.01)).toBeGreaterThan(fovAt(outro.start + 0.01));
  });
});
