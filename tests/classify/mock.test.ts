import { describe, expect, it } from "vitest";
import { mockClassify } from "../../src/classify/mock";
import { explicitShot, firstMention, norm, resolveSpeaker } from "../../src/classify/text";
import { talkshow } from "../../src/fixtures/studios";

const c = (s: string, ctx: Parameters<typeof mockClassify>[1] = []) => mockClassify(s, ctx, talkshow);

describe("text helpers", () => {
  it("normalises diacritics", () => {
    expect(norm("Mārtiņš")).toBe("martins");
  });

  it("resolves names, aliases and initials, with lower confidence for short aliases", () => {
    expect(resolveSpeaker("ANNA", talkshow)).toEqual({ id: "anna", confidence: 0.95 });
    expect(resolveSpeaker("Mārtiņš", talkshow)?.id).toBe("martins");
    expect(resolveSpeaker("M", talkshow)).toEqual({ id: "martins", confidence: 0.8 });
    expect(resolveSpeaker("Peteris", talkshow)).toBeNull();
  });

  it("finds the first mention and ignores single-letter aliases inside words", () => {
    expect(firstMention("Anna turns to Mārtiņš", talkshow)?.id).toBe("anna");
    expect(firstMention("a man walks in", talkshow)).toBeNull();
  });

  it("reads explicit shot sizes but not 'close show'", () => {
    expect(explicitShot("cut to close on Laura")).toBe("close");
    expect(explicitShot("OPEN wide on studio")).toBe("wide");
    expect(explicitShot("cut to medium on Anna")).toBe("medium");
    expect(explicitShot("close show")).toBeNull();
  });
});

describe("mock classifier", () => {
  it("labels prefixed dialogue", () => {
    expect(c("LAURA - can I jump in here")).toMatchObject({ type: "dialogue", speakerId: "laura", text: "can I jump in here" });
    expect(c("Anna — we'll come back")).toMatchObject({ type: "dialogue", speakerId: "anna" });
  });

  it("passes an unknown speaker through for validation to flag", () => {
    expect(c("PETERIS: thanks")).toMatchObject({ type: "dialogue", speakerId: "peteris" });
  });

  it("labels brackets by tag", () => {
    expect(c("[GFX: budget chart]")).toMatchObject({ type: "visual", text: "budget chart" });
    expect(c("[CUE: break bumper]")).toMatchObject({ type: "cue" });
    expect(c("[CUT TO WIDE]")).toMatchObject({ type: "cut", shot: "wide" });
  });

  it("labels cuts, cues and actions", () => {
    expect(c("cut to close on Laura")).toMatchObject({ type: "cut", speakerId: "laura", shot: "close" });
    expect(c("OPEN wide on studio, music up")).toMatchObject({ type: "cue", shot: "wide", speakerId: null });
    expect(c("Laura laughs")).toMatchObject({ type: "action", speakerId: "laura" });
  });

  it("uses context for 'she continues', with low confidence", () => {
    const out = c("she continues: more", [{ type: "dialogue", speakerId: "laura", text: "x", shot: null }]);
    expect(out.speakerId).toBe("laura");
    expect((out.confidence as { speakerId: number }).speakerId).toBeLessThan(0.7);
  });
});
