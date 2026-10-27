import { describe, expect, it } from "vitest";
import { validate } from "../../src/classify/validate";
import { talkshow } from "../../src/fixtures/studios";

const ok = { type: "dialogue", speakerId: "anna", text: "hi", shot: null, confidence: { type: 0.9, speakerId: 0.9, shot: 1 } };

describe("validate", () => {
  it("accepts a valid classification", () => {
    expect(validate(ok, "ANNA: hi", talkshow)).toMatchObject({ type: "dialogue", speakerId: "anna", invalid: [], needsReview: false });
  });

  it("nulls an unknown speaker, zeroes its confidence and flags it", () => {
    const v = validate({ ...ok, speakerId: "peteris" }, "x", talkshow);
    expect(v.speakerId).toBeNull();
    expect(v.confidence.speakerId).toBe(0);
    expect(v.invalid).toEqual(["speakerId"]);
    expect(v.needsReview).toBe(true);
  });

  it("nulls invalid enums", () => {
    const v = validate({ ...ok, type: "monologue", shot: "extreme" }, "x", talkshow);
    expect(v.type).toBeNull();
    expect(v.shot).toBeNull();
    expect(v.invalid).toEqual(["type", "shot"]);
  });

  it("treats missing fields and garbage confidence as failures, never guesses", () => {
    const v = validate({ type: undefined, speakerId: 42, text: undefined, shot: undefined, confidence: "high" }, "raw line", talkshow);
    expect(v.type).toBeNull();
    expect(v.speakerId).toBeNull();
    expect(v.text).toBe("raw line");
    expect(v.confidence).toEqual({ type: 0, speakerId: 0, shot: 0 });
    expect(v.needsReview).toBe(true);
  });

  it("flags low confidence for review without marking it invalid", () => {
    const v = validate({ ...ok, confidence: { type: 0.9, speakerId: 0.6, shot: 1 } }, "x", talkshow);
    expect(v.needsReview).toBe(true);
    expect(v.invalid).toEqual([]);
  });

  it("clamps confidence into 0..1", () => {
    expect(validate({ ...ok, confidence: { type: 3, speakerId: -1, shot: 1 } }, "x", talkshow).confidence).toEqual({
      type: 1,
      speakerId: 0,
      shot: 1,
    });
  });
});
