import { describe, expect, it } from "vitest";
import type { SystemOneRequest } from "@typesafe-ai/sdk";
import { DEFAULT_JEV_MODEL, jevClassifySegment, type SystemOne } from "../../server/jev";
import { jevQuestions, jevState, NO_PERSON, NO_SHOT } from "../../server/jev-questions";
import { validate } from "../../src/classify/validate";
import { talkshow } from "../../src/fixtures/studios";
import { JEV_USD_PER_MTOK } from "../../src/model/constants";

const req = { segment: "M: not a disaster, a missed chance", context: [], studio: talkshow };

const choice = (pick: string, confidence = 0.95) => ({ type: "choice", choice: pick, confidence, probabilities: { [pick]: confidence } });
const answers = (over: Record<string, unknown> = {}) => ({
  model: "jev-1.14.0",
  answers: {
    type: choice("dialogue"),
    speaker: choice("martins", 0.9),
    shot: choice(NO_SHOT, 0.99),
    unknown_speaker: { type: "noul", noul: 0.03 },
    ...over,
  },
  usage: { input_tokens: 1000, output_tokens: 40 },
});

/** A stub API that records the request it got and replies with `body`. */
function stub(body: unknown) {
  const sent: SystemOneRequest[] = [];
  const call: SystemOne = async (r) => {
    sent.push(r);
    return body;
  };
  return { call, sent };
}

describe("jev questions and state", () => {
  it("asks the three spec questions plus unknown_speaker in one request", () => {
    const q = jevQuestions(talkshow);
    expect(Object.keys(q)).toEqual(["type", "speaker", "shot", "unknown_speaker"]);
    expect(Object.keys(q.type.criteria)).toEqual(["dialogue", "action", "visual", "cut", "cue", "note"]);
    expect(Object.keys(q.speaker.criteria)).toEqual(["anna", "martins", "laura", NO_PERSON]);
    expect(Object.keys(q.shot.criteria)).toEqual(["close", "medium", "wide", NO_SHOT]);
    expect(q.unknown_speaker.type).toBe("noul");
  });

  it("lists each person's aliases in the speaker criteria", () => {
    const criteria: Record<string, unknown> = jevQuestions(talkshow).speaker.criteria;
    const martins = String(criteria.martins);
    for (const alias of ["Mārtiņš", "M"]) expect(martins).toContain(alias);
  });

  it("puts the cast, the previous rows (oldest first) and the line in the state", () => {
    const s = jevState("she continues", [
      { type: "dialogue", speakerId: "anna", text: "one", shot: null },
      { type: "dialogue", speakerId: "laura", text: "two", shot: null },
    ], talkshow);
    expect(Object.keys(s.cast)).toEqual(["anna", "martins", "laura"]);
    expect(s.previous_lines).toEqual(["dialogue | anna | one", "dialogue | laura | two"]);
    expect(s.line).toBe("she continues");
  });

  it("says in words when there is no context, instead of sending an empty list", () => {
    expect(typeof jevState("x", [], talkshow).previous_lines).toBe("string");
  });
});

describe("jevClassifySegment with a stubbed API", () => {
  it("sends the pinned model and maps answers to row fields", async () => {
    const { call, sent } = stub(answers());
    const out = await jevClassifySegment(req, call);
    expect(sent[0]?.model).toBe(DEFAULT_JEV_MODEL);
    expect(out).toMatchObject({
      type: "dialogue",
      speakerId: "martins",
      shot: null,
      text: "not a disaster, a missed chance",
      confidence: { type: 0.95, speakerId: 0.9, shot: 0.99 },
      failed: [],
    });
  });

  it("maps Jev's confidence straight into the row, so a low one goes yellow", async () => {
    const { call } = stub(answers({ speaker: choice("martins", 0.4) }));
    const v = validate(await jevClassifySegment(req, call), req.segment, talkshow);
    expect(v.confidence.speakerId).toBe(0.4);
    expect(v).toMatchObject({ speakerId: "martins", invalid: [], needsReview: true });
  });

  it("turns 'none' into a null speaker", async () => {
    const { call } = stub(answers({ speaker: choice(NO_PERSON) }));
    expect((await jevClassifySegment(req, call)).speakerId).toBeNull();
  });

  it("flags the speaker red when the line names someone outside the cast", async () => {
    const { call } = stub(answers({ speaker: choice("anna", 0.5), unknown_speaker: { type: "noul", noul: 0.92 } }));
    const v = validate(await jevClassifySegment({ ...req, segment: "PETERIS: hello" }, call), "PETERIS: hello", talkshow);
    expect(v).toMatchObject({ speakerId: null, invalid: ["speakerId"], needsReview: true });
    expect(v.confidence.speakerId).toBe(0);
  });

  it("fails only the field whose answer is missing or malformed", async () => {
    const { call } = stub(answers({ shot: undefined, type: { type: "choice", choice: "dialogue" } }));
    const v = validate(await jevClassifySegment(req, call), req.segment, talkshow);
    expect(v).toMatchObject({ type: null, shot: null, speakerId: "martins" });
    expect(v.invalid.sort()).toEqual(["shot", "type"]);
    expect(v.confidence).toMatchObject({ type: 0, shot: 0 });
  });

  it("nulls an option outside the allowed list through validation", async () => {
    const { call } = stub(answers({ type: choice("monologue") }));
    const v = validate(await jevClassifySegment(req, call), req.segment, talkshow);
    expect(v).toMatchObject({ type: null, invalid: ["type"] });
  });

  it("reports the model, latency and cost from the token count", async () => {
    const { call } = stub(answers());
    const { meta } = await jevClassifySegment(req, call);
    expect(meta?.model).toBe("jev-1.14.0");
    expect(meta?.inputTokens).toBe(1000);
    expect(meta?.costUsd).toBeCloseTo((1000 * JEV_USD_PER_MTOK) / 1e6);
    expect(meta?.ms).toBeGreaterThanOrEqual(0);
  });

  it("throws on a body that is not a System One response, so the row is flagged", async () => {
    await expect(jevClassifySegment(req, stub({ error: "x" }).call)).rejects.toThrow();
  });

  it("throws when the API call fails, never treating it as an answer", async () => {
    const failing: SystemOne = async () => {
      throw new Error("401 Unauthorized");
    };
    await expect(jevClassifySegment(req, failing)).rejects.toThrow("401");
  });
});
