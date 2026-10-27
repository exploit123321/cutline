import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { classifyAll } from "../../src/classify/loop";
import { mockClassifyOne } from "../../src/classify/mock";
import { segment } from "../../src/classify/segment";
import { planShow, runEngine } from "../../src/engine";
import { lineSide } from "../../src/geometry";
import { talkshow } from "../../src/fixtures/studios";
import type { Camera, Row, Studio } from "../../src/model/types";
import { tiny, camB } from "../geometry/fixture";
import { row, words } from "./helpers";

const sample = readFileSync(new URL("../../src/fixtures/rundowns/talkshow-01.txt", import.meta.url), "utf8");
const sampleRows = () => classifyAll(segment(sample), talkshow, mockClassifyOne);

describe("cut engine on the sample", () => {
  it("gives identical output for identical input", async () => {
    const rows = await sampleRows();
    const a = planShow({ studio: talkshow, rows });
    const b = planShow({ studio: structuredClone(talkshow), rows: structuredClone(rows) });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("fills camera, fov, timing and reason on every row", async () => {
    const rows = runEngine({ studio: talkshow, rows: await sampleRows() });
    for (const r of rows) {
      expect(r.cameraId, r.raw).not.toBeNull();
      expect(r.fov, r.raw).toBeGreaterThan(0);
      expect(r.start, r.raw).not.toBeNull();
      expect(r.duration, r.raw).not.toBeNull();
      expect(r.reason, r.raw).toBeTruthy();
    }
    const last = rows.at(-1) as Row;
    expect(last.start).toBeGreaterThan(10);
  });

  it("frames each speaker from the camera that sees their face", async () => {
    const rows = runEngine({ studio: talkshow, rows: await sampleRows() });
    const anna = rows.find((r) => r.type === "dialogue" && r.speakerId === "anna");
    const martins = rows.find((r) => r.type === "dialogue" && r.speakerId === "martins");
    expect(anna?.cameraId).toBe("cam3");
    expect(martins?.cameraId).toBe("cam2");
  });

  it("does not depend on mutable input: the input rows are untouched", async () => {
    const rows = await sampleRows();
    const copy = structuredClone(rows);
    runEngine({ studio: talkshow, rows });
    expect(rows).toEqual(copy);
  });
});

describe("180° line over a long exchange", () => {
  // camY sits behind the Alice–Bob line with a usable angle on Alice's face,
  // so only the line rule keeps it out
  const camY: Camera = { ...camB, id: "camy", label: "CAMY", position: { x: 5, y: 1.2, z: -1 } };
  const studio: Studio = { ...tiny, cameras: [...tiny.cameras, camY] };

  it("never puts a camera on the far side once the exchange has started", () => {
    const pattern = ["a", "a", "b", "a", "b", "b", "b", "a", "a", "a", "b"];
    const rows = pattern.flatMap((s, i) => [
      row("dialogue", s, words(6 + (i % 4) * 3)),
      ...(i % 3 === 0 ? [row("action", s, "reacts")] : []),
    ]);
    const out = runEngine({ studio, rows });
    const a = tiny.people[0]!.position;
    const b = tiny.people[1]!.position;
    const firstB = out.findIndex((r) => r.speakerId === "b");
    const side = (id: string | null) => lineSide(a, b, studio.cameras.find((c) => c.id === id)!.position);
    const ref = side(out[firstB - 1]!.cameraId);
    for (const r of out.slice(firstB)) expect(side(r.cameraId), `${r.text} → ${r.cameraId}`).not.toBe(-ref);
  });
});
