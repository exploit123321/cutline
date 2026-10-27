import { describe, expect, it } from "vitest";
import {
  baseDuration,
  chooseShot,
  fallback,
  frame,
  isCandidate,
  mayCrossLine,
  planShow,
  rank,
  respectsLine,
  runEngine,
  score,
} from "../../src/engine";
import type { Camera, Studio } from "../../src/model/types";
import { alice, bob, camA, camB, camX, tiny } from "../geometry/fixture";
import { row, words } from "./helpers";

/** Behind the line, but with a decent view of Alice's face (54.5° off). */
const camY: Camera = { ...camB, id: "camy", label: "CAMY", position: { x: 5, y: 1.2, z: -1 } };
const withY: Studio = { ...tiny, cameras: [...tiny.cameras, camY] };

describe("rule 1: locked rows keep camera and timing", () => {
  it("keeps a locked camera and duration even when the engine would choose differently", () => {
    const rows = runEngine({
      studio: tiny,
      rows: [row("dialogue", "a", words(10), { locked: true, cameraId: "camx", duration: 7 })],
    });
    expect(rows[0]).toMatchObject({ cameraId: "camx", duration: 7, start: 0 });
    expect(rows[0]?.reason).toMatch(/Locked/);
  });
});

describe("rule 2: shot choice", () => {
  const shot = (r: ReturnType<typeof row>) => chooseShot(r, tiny).shot;
  it("dialogue → medium on the speaker", () => {
    const c = chooseShot(row("dialogue", "a", "hi"), tiny);
    expect(c.shot).toBe("medium");
    expect(c.subjects.map((p) => p.id)).toEqual(["a"]);
  });
  it("action, visual, cue and speakerless rows → wide on everyone", () => {
    expect(shot(row("action", "a", "Alice laughs"))).toBe("wide");
    expect(shot(row("visual", null, "chart"))).toBe("wide");
    expect(shot(row("cue", null, "sting"))).toBe("wide");
    expect(shot(row("dialogue", null, "who said this"))).toBe("wide");
    expect(chooseShot(row("cue", null, "x"), tiny).subjects).toHaveLength(2);
  });
  it("a cut that says 'close on Alice' → close", () => {
    expect(shot(row("cut", "a", "cut to close on Alice"))).toBe("close");
  });
  it("an explicit shot on the row wins", () => {
    expect(shot(row("dialogue", "a", "hi", { shot: "close" }))).toBe("close");
  });
});

describe("rule 3: candidate cameras", () => {
  it("medium on Alice: camB sees her face, camA (71.6°) and camX (90°) do not", () => {
    expect(isCandidate(frame(camB, [alice], "medium"), "medium")).toBe(true);
    expect(isCandidate(frame(camA, [alice], "medium"), "medium")).toBe(false);
    expect(isCandidate(frame(camX, [alice], "medium"), "medium")).toBe(false);
  });
  it("wide shots ignore frontality but need everyone in view", () => {
    expect(isCandidate(frame(camX, [alice, bob], "wide"), "wide")).toBe(true);
    const lookingAway: Camera = { ...camA, fixed: true, yaw: 180 };
    expect(isCandidate(frame(lookingAway, [alice, bob], "wide"), "wide")).toBe(false);
  });
});

describe("rule 4: 180° line", () => {
  it("respectsLine keeps cameras on the exchange side and allows cameras on the line", () => {
    const line = { a: alice, b: bob, side: 1 as const };
    expect(respectsLine(camA, line)).toBe(true);
    expect(respectsLine(camX, line)).toBe(false);
    expect(respectsLine({ ...camX, position: { x: 4, y: 1.2, z: 0 } }, line)).toBe(true);
  });

  it("a wide cut or cue may cross only when its text says so", () => {
    expect(mayCrossLine(row("cut", null, "reverse wide, cross the line"), "wide")).toBe(true);
    expect(mayCrossLine(row("cut", null, "wide"), "wide")).toBe(false);
    expect(mayCrossLine(row("dialogue", null, "cross the line"), "wide")).toBe(false);
    expect(mayCrossLine(row("cut", null, "cross the line"), "medium")).toBe(false);
  });

  it("without an exchange, camY is the better second shot of Alice", () => {
    const rows = runEngine({ studio: withY, rows: [row("dialogue", "a", words(10)), row("dialogue", "a", words(10))] });
    expect(rows.map((r) => r.cameraId)).toEqual(["camb", "camy"]);
  });

  it("once Alice and Bob are in an exchange, camY is ruled out", () => {
    const rows = runEngine({
      studio: withY,
      rows: [
        row("dialogue", "a", words(10)),
        row("dialogue", "b", words(10)),
        row("dialogue", "a", words(10)),
        row("dialogue", "a", words(10)),
      ],
    });
    expect(rows.map((r) => r.cameraId)).toEqual(["camb", "cama", "camb", "camb"]);
    expect(rows[3]?.reason).toMatch(/holds Alice–Bob line/);
  });
});

describe("rule 5: scoring", () => {
  const none = { cameraId: null, shot: null };
  it("follows 1·(1 − frontality/90) + 0.3·shotMatch − 1·sameAsPrevious", () => {
    const f = frame(camB, [alice], "medium");
    expect(f.frontality).toBeCloseTo(0);
    expect(f.clamped).toBe(false);
    expect(score(f, "medium", none)).toBeCloseTo(1.3);
    expect(score(f, "medium", { cameraId: "camb", shot: "medium" })).toBeCloseTo(0.3);
    expect(score(f, "medium", { cameraId: "camb", shot: "wide" })).toBeCloseTo(1.3);
  });
  it("shotMatch is 0 when the lens had to clamp", () => {
    const tightLens: Camera = { ...camB, fovRange: [40, 60] };
    const f = frame(tightLens, [alice], "close");
    expect(f.clamped).toBe(true);
    expect(score(f, "close", none)).toBeCloseTo(1.0);
  });
  it("breaks ties by camera id", () => {
    const fa = frame(camA, [alice, bob], "wide");
    const fb = frame(camB, [alice, bob], "wide");
    expect(score(fa, "wide", none)).toBeCloseTo(score(fb, "wide", none));
    expect(rank([{ framing: fb, score: 1 }, { framing: fa, score: 1 }])[0]?.framing.camera.id).toBe("cama");
  });
  it("two wides in a row alternate cameras because of the repeat penalty", () => {
    const rows = runEngine({ studio: tiny, rows: [row("cue", null, "open"), row("visual", null, "gfx")] });
    expect(rows.map((r) => r.cameraId)).toEqual(["cama", "camb"]);
  });
});

describe("rule 6: no candidate", () => {
  const blind: Studio = { ...tiny, cameras: [camA, camX] };
  it("falls back to the widest camera that sees everyone and flags the row", () => {
    const rows = runEngine({ studio: blind, rows: [row("dialogue", "a", words(10))] });
    expect(rows[0]?.cameraId).toBe("cama");
    expect(rows[0]?.fov).toBe(60);
    expect(rows[0]?.needsReview).toBe(true);
    expect(rows[0]?.reason).toMatch(/fallback/);
  });
  it("prefers the camera with the wider lens", () => {
    const wider = { ...camX, fovRange: [5, 70] as [number, number] };
    expect(fallback({ ...blind, cameras: [camA, wider] }).camera.id).toBe("camx");
  });
});

describe("rule 7: timing", () => {
  it("dialogue lasts words / 2.5 s with a 1.5 s floor; other rows 2 s; notes are off air", () => {
    expect(baseDuration(row("dialogue", "a", words(10)))).toBeCloseTo(4);
    expect(baseDuration(row("dialogue", "a", "yes"))).toBe(1.5);
    expect(baseDuration(row("action", "a", words(30)))).toBe(2);
    expect(baseDuration(row("note", null, "keep it short"))).toBe(0);
  });

  it("merges a row under the 2 s hold into the previous shot, and start is cumulative", () => {
    const plan = planShow({ studio: tiny, rows: [row("dialogue", "a", words(10)), row("dialogue", "b", "sure thing")] });
    expect(plan.rows.map((r) => r.cameraId)).toEqual(["camb", "camb"]);
    expect(plan.rows.map((r) => r.start)).toEqual([0, 4]);
    expect(plan.rows[1]?.reason).toMatch(/minimum hold/);
    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0]?.duration).toBeCloseTo(5.5);
  });

  it("does not merge a short cut row", () => {
    const rows = runEngine({
      studio: tiny,
      rows: [row("dialogue", "a", words(10)), row("cut", "b", "cut to Bob", { locked: true, duration: 1 })],
    });
    expect(rows[1]?.cameraId).toBe("cama");
  });
});

describe("rule 8: reasons", () => {
  it("fills a reason on every row", () => {
    const rows = runEngine({
      studio: withY,
      rows: [
        row("cue", null, "open"),
        row("dialogue", "a", words(8)),
        row("dialogue", "b", "ok"),
        row("note", null, "fix mic"),
        row("cut", "a", "close on Alice"),
      ],
    });
    for (const r of rows) expect(r.reason, r.text).toBeTruthy();
  });
});

describe("screen segments", () => {
  const screenShow = () =>
    planShow({
      studio: tiny,
      rows: [
        row("dialogue", "a", words(10)),
        row("visual", null, "article | A headline"),
        row("dialogue", "b", words(10)),
        row("action", "a", "Alice laughs"),
        row("dialogue", "a", words(10)),
        row("cut", null, "back to wide"),
        row("dialogue", "b", words(10)),
      ],
    });

  it("keeps talk on the screen's shot, so there is no cut while the screen is up", () => {
    const { rows } = screenShow();
    const [, visual, talk, , talkAgain] = rows;
    expect(talk?.cameraId).toBe(visual?.cameraId);
    expect(talk?.fov).toBe(visual?.fov);
    expect(talk?.reason).toMatch(/^On screen: article · Bob in the corner box/);
    expect(talkAgain?.cameraId).toBe(visual?.cameraId);
  });

  it("merges the screen and the talk on it into one shot block", () => {
    const plan = screenShow();
    const visual = plan.rows[1];
    const block = plan.blocks.find((b) => b.rowIds.includes(visual?.id ?? ""));
    expect(block?.rowIds).toContain(plan.rows[2]?.id);
  });

  it("gives an action inside the segment its own reaction shot", () => {
    const plan = screenShow();
    const action = plan.rows[3];
    expect(action?.reason).not.toMatch(/^On screen/);
    expect(plan.blocks.find((b) => b.rowIds.includes(action?.id ?? ""))?.rowIds).toEqual([action?.id]);
  });

  it("ends the segment at a cut", () => {
    const { rows } = screenShow();
    expect(rows[6]?.reason).not.toMatch(/^On screen/);
  });
});
