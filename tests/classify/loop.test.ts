import { describe, expect, it } from "vitest";
import { classifyAll, screenOnAir } from "../../src/classify/loop";
import { mockClassifyOne } from "../../src/classify/mock";
import { segment } from "../../src/classify/segment";
import type { ClassifyOne, ContextRow, OnScreen } from "../../src/classify/types";
import type { Row } from "../../src/model/types";
import { talkshow } from "../../src/fixtures/studios";
import { readFileSync } from "node:fs";

const sample = readFileSync(new URL("../../src/fixtures/rundowns/talkshow-01.txt", import.meta.url), "utf8");

describe("classify loop", () => {
  it("turns the sample into one row per segment", async () => {
    const rows = await classifyAll(segment(sample), talkshow, mockClassifyOne);
    expect(rows).toHaveLength(13);
    expect(rows.map((r) => r.index)).toEqual([...Array(13).keys()]);
    expect(rows[4]).toMatchObject({ type: "dialogue", speakerId: "martins" });
  });

  it("passes at most the previous 5 rows as context, oldest first", async () => {
    const seen: ContextRow[][] = [];
    const spy: ClassifyOne = async (input) => {
      seen.push(input.context);
      return mockClassifyOne(input);
    };
    await classifyAll(segment(sample), talkshow, spy);
    expect(seen[0]).toEqual([]);
    expect(seen[3]).toHaveLength(3);
    expect(seen[12]).toHaveLength(5);
    expect(seen[12]?.[4]?.text).toBe("we'll come back to that after the break");
  });

  it("flags an unknown speaker red (invalid) after validation", async () => {
    const rows = await classifyAll(["PETERIS: hello"], talkshow, mockClassifyOne);
    expect(rows[0]).toMatchObject({ speakerId: null, invalid: ["speakerId"], needsReview: true });
  });

  it("turns a provider error into a fully flagged row instead of failing the parse", async () => {
    const broken: ClassifyOne = async () => {
      throw new Error("network down");
    };
    const rows = await classifyAll(["ANNA: hi"], talkshow, broken);
    expect(rows[0]).toMatchObject({ type: null, needsReview: true, invalid: ["type", "speakerId", "shot"] });
  });

  it("never overwrites a locked row on re-parse, and uses it as context", async () => {
    const first = await classifyAll(segment(sample), talkshow, mockClassifyOne);
    const edited = first.map((r) => (r.index === 4 ? { ...r, speakerId: "laura", locked: true } : r));
    const seen: ContextRow[][] = [];
    const spy: ClassifyOne = async (input) => {
      seen.push(input.context);
      return mockClassifyOne(input);
    };
    // a new line at the top shifts every index by one
    const again = await classifyAll(segment(`[CUE: sting]\n${sample}`), talkshow, spy, edited);
    expect(again).toHaveLength(14);
    expect(again[5]).toMatchObject({ id: edited[4]?.id, speakerId: "laura", locked: true, index: 5 });
    // the locked row was not sent to the classifier
    expect(seen).toHaveLength(13);
    // and the next call saw the human's correction in its context
    expect(seen[5]?.at(-1)?.speakerId).toBe("laura");
  });
});

describe("screenOnAir", () => {
  const row = (type: Row["type"], text = type ?? "") => ({ type, text }) as Row;

  it("is the last visual row, counted back from the row to come", () => {
    expect(screenOnAir([row("visual", "chart | Budget"), row("dialogue"), row("note")])).toEqual({ text: "chart | Budget", linesAgo: 3 });
    expect(screenOnAir([row("dialogue"), row("visual", "poll")])).toEqual({ text: "poll", linesAgo: 1 });
  });

  it("ends on a cut or a cue, and a newer visual replaces it (engine rule 9)", () => {
    expect(screenOnAir([row("visual"), row("cut")])).toBeNull();
    expect(screenOnAir([row("visual"), row("cue"), row("dialogue")])).toBeNull();
    expect(screenOnAir([row("visual", "one"), row("action"), row("visual", "two")])?.text).toBe("two");
    expect(screenOnAir([])).toBeNull();
  });

  it("is passed to the provider for each row", async () => {
    const seen: (OnScreen | null | undefined)[] = [];
    const spy: ClassifyOne = async (input) => {
      seen.push(input.onScreen);
      return mockClassifyOne(input);
    };
    await classifyAll(["[GFX: budget chart]", "ANNA: look at this", "cut to wide"], talkshow, spy);
    expect(seen).toEqual([null, { text: "budget chart", linesAgo: 1 }, { text: "budget chart", linesAgo: 2 }]);
  });
});
