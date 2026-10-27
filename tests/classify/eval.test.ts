import { describe, expect, it } from "vitest";
import { calibration, evaluate, flaggedButRight, formatReport, formatTable, type Scored } from "../../src/classify/eval";
import { mockClassifyOne } from "../../src/classify/mock";
import { podcast, talkshow } from "../../src/fixtures/studios";
import { isBrief, loadRundownFixtures } from "../../scripts/fixtures";

describe("eval on the hand-labelled rundowns (mock provider)", () => {
  it("has scripted rundowns and a brief, whose segments line up with the labels", async () => {
    const fixtures = loadRundownFixtures();
    expect(fixtures.filter((f) => !isBrief(f)).length).toBeGreaterThanOrEqual(3);
    expect(fixtures.some(isBrief)).toBe(true);
    const report = await evaluate(fixtures, mockClassifyOne);
    expect(report.mismatches.filter((m) => m.field === "segment")).toEqual([]);
  });

  it("gives each fixture the studio its labels name", () => {
    const byName = Object.fromEntries(loadRundownFixtures().map((f) => [f.name, f.studio.id]));
    expect(byName["talkshow-01"]).toBe(talkshow.id);
    expect(byName["podcast-01"]).toBe(podcast.id);
    expect(byName["brief-01"]).toBe(podcast.id);
  });

  it("keeps the mock baseline from regressing on scripted rundowns", async () => {
    const report = await evaluate(loadRundownFixtures().filter((f) => !isBrief(f)), mockClassifyOne);
    expect(report.accuracy.type).toBeGreaterThanOrEqual(0.95);
    expect(report.accuracy.speakerId).toBeGreaterThanOrEqual(0.95);
    expect(report.accuracy.shot).toBeGreaterThanOrEqual(0.95);
    expect(formatReport(report, "mock")).toContain("speakerId");
  });
});

describe("eval report", () => {
  it("counts wrong answers as caught by review or slipped through, and sums latency and cost", async () => {
    const fixtures = [
      {
        name: "tiny",
        studio: talkshow,
        text: "ANNA: hi\nLaura laughs",
        expected: [
          { raw: "ANNA: hi", type: "dialogue" as const, speakerId: "anna", shot: null },
          { raw: "Laura laughs", type: "action" as const, speakerId: "laura", shot: null },
        ],
      },
    ];
    // wrong on both rows: confidently on the first (slips), unsure on the second (caught)
    const report = await evaluate(fixtures, async ({ segment }) => {
      const sure = segment.startsWith("ANNA");
      const c = sure ? 0.95 : 0.4;
      return {
        type: "note",
        speakerId: sure ? "anna" : "laura",
        text: segment,
        shot: null,
        confidence: { type: c, speakerId: 0.95, shot: 0.95 },
        meta: { ms: 100, costUsd: 0.5, model: "fake-1" },
      };
    });
    expect(report.mismatches.map((m) => [m.raw, m.caught])).toEqual([
      ["ANNA: hi", false],
      ["Laura laughs", true],
    ]);
    expect(report).toMatchObject({ calls: 2, avgMs: 100, costUsd: 1, model: "fake-1" });
    expect(report.byFixture).toEqual([{ name: "tiny", total: 2, correct: { type: 0, speakerId: 2, shot: 2 } }]);
    expect(formatReport(report, "fake")).toMatch(/caught by review .*: 1 .*slipped through: 1/);
    expect(formatTable([["fake", report]])).toContain("| flagged but right |");
  });
});

describe("calibration table", () => {
  const s = (score: number, ok: boolean, invalid = false): Scored => ({ field: "type", score, ok, invalid });

  it("groups answers by score, counts the right ones, and averages the score per band", () => {
    const bands = calibration([s(1, true), s(0.98, false), s(0.95, true), s(0.8, true), s(0.6, true), s(0.1, false)]);
    expect(bands.map((b) => [b.lo, b.hi, b.answers, b.right])).toEqual([
      [0.97, 1, 2, 1],
      [0.9, 0.97, 1, 1],
      [0.7, 0.9, 1, 1],
      [0.5, 0.7, 1, 1],
      [0, 0.5, 1, 0],
    ]);
    expect(bands[0]?.meanScore).toBeCloseTo(0.99);
  });

  it("puts a score on a band edge in the upper band, so the threshold itself is not flagged", () => {
    const bands = calibration([s(0.7, true), s(0.97, true)]);
    expect(bands.find((b) => b.lo === 0.7)?.answers).toBe(1);
    expect(bands.find((b) => b.lo === 0.97)?.answers).toBe(1);
  });

  it("leaves invalid fields out: a red cell is a rule, not a judgment", () => {
    expect(calibration([s(0, true, true)]).every((b) => b.answers === 0)).toBe(true);
  });

  it("counts right answers below the threshold as flagged but right", () => {
    expect(flaggedButRight([s(0.6, true), s(0.6, false), s(0.9, true), s(0, true, true)])).toBe(1);
  });
});
