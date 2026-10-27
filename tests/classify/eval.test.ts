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
