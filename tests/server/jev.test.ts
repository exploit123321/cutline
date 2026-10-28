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
    speaks: choice("martins", 0.9),
    subject: choice(NO_PERSON, 0.8),
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
  it("asks the spec questions, with the speaker as two questions, in one request", () => {
    const q = jevQuestions(talkshow);
    expect(Object.keys(q)).toEqual(["type", "speaks", "subject", "shot", "general_advice", "quote_is_line", "asks_for_shot", "shows_reaction", "unknown_speaker"]);
    expect(Object.keys(q.type.criteria)).toEqual(["dialogue", "action", "visual", "cut", "cue", "note"]);
    for (const k of ["speaks", "subject"] as const) expect(Object.keys(q[k].criteria)).toEqual(["anna", "martins", "laura", NO_PERSON]);
    expect(Object.keys(q.shot.criteria)).toEqual(["close", "medium", "wide", NO_SHOT]);
    expect(q.unknown_speaker.type).toBe("noul");
  });

  it("lists each person's aliases in both speaker questions", () => {
    const q = jevQuestions(talkshow);
    for (const criteria of [q.speaks.criteria, q.subject.criteria] as Record<string, unknown>[]) {
      for (const alias of ["Mārtiņš", "M"]) expect(String(criteria.martins)).toContain(alias);
    }
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
    const { call } = stub(answers({ speaks: choice("martins", 0.4) }));
    const v = validate(await jevClassifySegment(req, call), req.segment, talkshow);
    expect(v.confidence.speakerId).toBe(0.4);
    expect(v).toMatchObject({ speakerId: "martins", invalid: [], needsReview: true });
  });

  it("turns 'none' into a null speaker", async () => {
    const { call } = stub(answers({ speaks: choice(NO_PERSON) }));
    expect((await jevClassifySegment(req, call)).speakerId).toBeNull();
  });

  it("flags the speaker red when the line names someone outside the cast", async () => {
    const { call } = stub(answers({ speaks: choice("anna", 0.5), unknown_speaker: { type: "noul", noul: 0.92 } }));
    const v = validate(await jevClassifySegment({ ...req, segment: "PETERIS: hello" }, call), "PETERIS: hello", talkshow);
    expect(v).toMatchObject({ speakerId: null, invalid: ["speakerId"], needsReview: true });
    expect(v.confidence.speakerId).toBe(0);
  });

  it("fails only the field whose answer is missing or malformed", async () => {
    // with no type, the row is not dialogue, so the speaker comes from `subject`
    const { call } = stub(answers({ shot: undefined, type: { type: "choice", choice: "dialogue" }, subject: choice("martins") }));
    const v = validate(await jevClassifySegment(req, call), req.segment, talkshow);
    expect(v).toMatchObject({ type: null, shot: null, speakerId: "martins" });
    expect(v.invalid.sort()).toEqual(["shot", "type"]);
    expect(v.confidence).toMatchObject({ type: 0, shot: 0 });
  });

  it("takes the speaker from `speaks` on dialogue and from `subject` on every other row", async () => {
    const talk = await jevClassifySegment(req, stub(answers({ speaks: choice("anna", 0.97), subject: choice("laura", 0.6) })).call);
    expect(talk).toMatchObject({ type: "dialogue", speakerId: "anna", confidence: { speakerId: 0.97 } });
    const act = await jevClassifySegment(req, stub(answers({ type: choice("action"), speaks: choice(NO_PERSON), subject: choice("laura", 0.88) })).call);
    expect(act).toMatchObject({ type: "action", speakerId: "laura", confidence: { speakerId: 0.88 } });
  });

  it("fails the speaker only when the answer it uses is malformed", async () => {
    const broken = { type: "choice", choice: "anna" };
    expect((await jevClassifySegment(req, stub(answers({ subject: broken })).call)).failed).toEqual([]);
    expect((await jevClassifySegment(req, stub(answers({ speaks: broken })).call)).failed).toEqual(["speakerId"]);
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

  it("makes a line with quoted words for the cast dialogue, with the words as its text", async () => {
    const seg = "Jamie could say “Wait, can we pull that up?” and then the director switches";
    const { call } = stub(answers({ type: choice("note", 0.6), speaks: choice("martins"), quote_is_line: { type: "noul", noul: 0.97 } }));
    const out = await jevClassifySegment({ ...req, segment: seg }, call);
    expect(out).toMatchObject({ type: "dialogue", text: "Wait, can we pull that up?", speakerId: "martins" });
    expect((out.confidence as { type: number }).type).toBeCloseTo(0.97);
  });

  it("makes general advice an off-air note", async () => {
    const { call } = stub(answers({ type: choice("visual", 0.9), general_advice: { type: "noul", noul: 0.9 } }));
    const out = await jevClassifySegment({ ...req, segment: "Maybe the screen should slide in rather than appear" }, call);
    expect(out.type).toBe("note");
  });

  it("flags an unsure advice answer for review, keeping Jev's type", async () => {
    const { call } = stub(answers({ type: choice("visual", 0.95), general_advice: { type: "noul", noul: 0.5 } }));
    const v = validate(await jevClassifySegment({ ...req, segment: "Could zoom in on the graph" }, call), "Could zoom in on the graph", talkshow);
    expect(v.type).toBe("visual");
    expect(v.confidence.type).toBeLessThanOrEqual(0.6);
    expect(v.needsReview).toBe(true);
  });

  it("keeps Jev's type when quotes are not lines and it is not advice", async () => {
    const { call } = stub(answers({ type: choice("visual", 0.9), quote_is_line: { type: "noul", noul: 0.05 }, general_advice: { type: "noul", noul: 0.05 } }));
    const out = await jevClassifySegment({ ...req, segment: "Could add labels like “Before” and “After”" }, call);
    expect(out).toMatchObject({ type: "visual", text: "Could add labels like “Before” and “After”" });
  });

  it("keeps general advice a note even when it quotes example lines", async () => {
    const seg = "Don't open cold. Instead of “Next topic”, have Anna say “That reminds me…”";
    const nouls = { general_advice: { type: "noul", noul: 0.85 }, quote_is_line: { type: "noul", noul: 0.95 } };
    const out = await jevClassifySegment({ ...req, segment: seg }, stub(answers({ type: choice("note", 0.9), ...nouls })).call);
    expect(out).toMatchObject({ type: "note", text: seg });
  });

  const noul = (p: number) => ({ type: "noul", noul: p });
  const moment = (over: Record<string, unknown>) =>
    answers({ type: choice("note", 0.8), general_advice: noul(0.1), quote_is_line: noul(0.03), subject: choice("laura", 0.9), ...over });

  it("makes a note that asks for a shot a cut, flagged because Jev's answers disagree", async () => {
    const out = await jevClassifySegment({ ...req, segment: "Maybe start wide on all three" }, stub(moment({ asks_for_shot: noul(0.95) })).call);
    expect(out).toMatchObject({ type: "cut", confidence: { type: 0.6 } });
  });

  it("makes a note that shows a reaction an action, with the subject as the speaker", async () => {
    const out = await jevClassifySegment({ ...req, segment: "Laura could react here" }, stub(moment({ shows_reaction: noul(0.9) })).call);
    expect(out).toMatchObject({ type: "action", speakerId: "laura" });
  });

  it("takes the surer of the two when a note asks for a shot and shows a reaction", async () => {
    const both = moment({ asks_for_shot: noul(0.8), shows_reaction: noul(0.93) });
    expect((await jevClassifySegment({ ...req, segment: "Laura laughs, stay wide" }, stub(both).call)).type).toBe("action");
  });

  it("keeps a note when neither answer is sure, or the answers are broken", async () => {
    const unsure = moment({ asks_for_shot: noul(0.6), shows_reaction: noul(0.25) });
    expect((await jevClassifySegment(req, stub(unsure).call)).type).toBe("note");
    const broken = moment({ asks_for_shot: { type: "noul" }, shows_reaction: "yes" });
    expect((await jevClassifySegment(req, stub(broken).call)).type).toBe("note");
  });

  it("never moves sure general advice, and never moves a beat that is not a note", async () => {
    const advice = moment({ general_advice: noul(0.9), asks_for_shot: noul(0.95) });
    expect((await jevClassifySegment(req, stub(advice).call)).type).toBe("note");
    const visual = moment({ type: choice("visual", 0.9), asks_for_shot: noul(0.95) });
    expect((await jevClassifySegment(req, stub(visual).call)).type).toBe("visual");
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
