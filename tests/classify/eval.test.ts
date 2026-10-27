import { describe, expect, it } from "vitest";
import { evaluate, formatReport } from "../../src/classify/eval";
import { mockClassifyOne } from "../../src/classify/mock";
import { talkshow } from "../../src/fixtures/studios";
import { loadRundownFixtures } from "../../scripts/fixtures";

describe("eval on the hand-labelled rundowns (mock provider)", () => {
  it("has at least three fixtures whose segments line up with the labels", async () => {
    const fixtures = loadRundownFixtures();
    expect(fixtures.length).toBeGreaterThanOrEqual(3);
    const report = await evaluate(fixtures, talkshow, mockClassifyOne);
    expect(report.mismatches.filter((m) => m.field === "segment")).toEqual([]);
  });

  it("keeps the mock baseline from regressing", async () => {
    const report = await evaluate(loadRundownFixtures(), talkshow, mockClassifyOne);
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
        text: "ANNA: hi\nLaura laughs",
        expected: [
          { raw: "ANNA: hi", type: "dialogue" as const, speakerId: "anna", shot: null },
          { raw: "Laura laughs", type: "action" as const, speakerId: "laura", shot: null },
        ],
      },
    ];
    // wrong on both rows: confidently on the first (slips), unsure on the second (caught)
    const report = await evaluate(fixtures, talkshow, async ({ segment }) => {
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
    expect(formatReport(report, "fake")).toMatch(/caught by review .*: 1 .*slipped through: 1/);
  });
});
