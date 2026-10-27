import { describe, expect, it } from "vitest";
import { classifySegment, hasApiKey, modelName } from "../../server/anthropic";
import { createApp } from "../../server/app";
import { evaluate, formatReport } from "../../src/classify/eval";
import { classifyAll } from "../../src/classify/loop";
import { talkshow } from "../../src/fixtures/studios";
import { runEngine } from "../../src/engine";
import { segment } from "../../src/classify/segment";
import { loadRundownFixtures } from "../../scripts/fixtures";
import type { ClassifyOne } from "../../src/classify/types";

/*
 * Live tests against the Anthropic API. They run only when ANTHROPIC_API_KEY is set
 * (in the environment or in .env) and cost a few cents per run.
 */
const live = describe.skipIf(!hasApiKey());
const llm: ClassifyOne = (input) => classifySegment(input);

live(`llm provider (${modelName()})`, () => {
  it("classifies one dialogue line into a schema-valid result", async () => {
    const out = await classifySegment({ segment: "ANNA: good evening and welcome", context: [], studio: talkshow });
    expect(out.type).toBe("dialogue");
    expect(out.speakerId).toBe("anna");
    expect(out.confidence.type).toBeGreaterThan(0.5);
  }, 60_000);

  it("serves the same through the HTTP endpoint", async () => {
    const res = await createApp().request("/api/classify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ segment: "[GFX: budget chart full screen]", context: [], studio: talkshow }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ type: "visual" });
  }, 60_000);

  it("uses context for 'she continues' and flags an unknown speaker", async () => {
    const rows = await classifyAll(
      ["LAURA: the ministry has not answered.", "MARTINS: they did, in March.", "she continues: two lines is not an answer", "PETERIS: may I add something"],
      talkshow,
      llm,
    );
    expect(rows[2]?.speakerId).toBe("laura");
    expect(rows[3]).toMatchObject({ speakerId: null, needsReview: true });
    expect(rows[3]?.invalid).toContain("speakerId");
  }, 120_000);

  it("parses the sample end to end and the engine cuts every row", async () => {
    const fx = loadRundownFixtures().find((f) => f.name === "talkshow-01");
    const rows = await classifyAll(segment(fx!.text), talkshow, llm);
    const cut = runEngine({ studio: talkshow, rows });
    expect(cut).toHaveLength(13);
    for (const r of cut) expect(r.reason).toBeTruthy();
  }, 180_000);

  it("scores well on the hand-labelled rundowns (eval)", async () => {
    const report = await evaluate(loadRundownFixtures(), talkshow, llm);
    console.log(formatReport(report, `llm (${modelName()})`));
    expect(report.mismatches.filter((m) => m.field === "segment")).toEqual([]);
    expect(report.accuracy.type).toBeGreaterThanOrEqual(0.8);
    expect(report.accuracy.speakerId).toBeGreaterThanOrEqual(0.9);
    expect(report.accuracy.shot).toBeGreaterThanOrEqual(0.85);
  }, 300_000);
});

describe.skipIf(hasApiKey())("llm provider without a key", () => {
  it("is skipped: set ANTHROPIC_API_KEY in .env to run the live tests", () => {
    expect(hasApiKey()).toBe(false);
  });
});
