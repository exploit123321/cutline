import { describe, expect, it } from "vitest";
import { box } from "../../src/models/format";
import { boundsOf, buildMetric, toMetric } from "../../src/models/adapter";
import { PRESETS } from "../../src/models/presets";

describe("preset adapter", () => {
  it("turns a 20 × 20 × 20 unit box into a 1 m cube", () => {
    const m = toMetric(box(0, 0, 0, 20, 20, 20, "#fff"));
    expect(m.size[0]).toBeCloseTo(1);
    expect(m.size[1]).toBeCloseTo(1);
    expect(m.size[2]).toBeCloseTo(1);
    // box() stands on yBottom, so the centre is half a metre up
    expect(m.position[1]).toBeCloseTo(0.5);
  });

  it("converts rotation from degrees to radians", () => {
    const m = toMetric({ kind: "box", c: [0, 0, 0], s: [1, 1, 1], r: [90, 180, 0], color: "#000" });
    expect(m.rotation[0]).toBeCloseTo(Math.PI / 2);
    expect(m.rotation[1]).toBeCloseTo(Math.PI);
  });

  it("every preset sits on the floor and has a plausible size", () => {
    for (const preset of Object.values(PRESETS)) {
      const { min, max } = boundsOf(buildMetric(preset));
      expect(min[1], preset.id).toBeGreaterThanOrEqual(-1e-9);
      expect(max[1], preset.id).toBeLessThan(4);
      expect(max[0] - min[0], preset.id).toBeLessThan(8);
    }
  });

  it("figures put their eyes (head centre) at the default eye heights", () => {
    const headY = (id: string) => buildMetric(PRESETS[id]!).find((p) => p.kind === "sphere")!.position[1];
    expect(headY("seatedFigure")).toBeCloseTo(1.2, 1);
    expect(headY("standingFigure")).toBeCloseTo(1.65, 1);
  });
});
