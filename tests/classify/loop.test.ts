import { describe, expect, it } from "vitest";
import { classifyAll } from "../../src/classify/loop";
import { mockClassifyOne } from "../../src/classify/mock";
import { segment } from "../../src/classify/segment";
import type { ClassifyOne, ContextRow } from "../../src/classify/types";
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
