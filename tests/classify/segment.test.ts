import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { segment } from "../../src/classify/segment";

describe("segment", () => {
  it("splits lines and drops blanks", () => {
    expect(segment("a\n\n  b  \r\nc")).toEqual(["a", "b", "c"]);
  });

  it("pulls bracketed cues out of a line", () => {
    expect(segment("[GFX: chart] ANNA: hello [CUE: sting]")).toEqual(["[GFX: chart]", "ANNA: hello", "[CUE: sting]"]);
  });

  it("splits a line where a new NAME: prefix starts after a sentence", () => {
    expect(segment("Laura: no answer yet. MARTINS: they did answer.")).toEqual([
      "Laura: no answer yet.",
      "MARTINS: they did answer.",
    ]);
  });

  it("does not split ordinary sentences or names without a colon", () => {
    expect(segment("Anna: Thursday then. Laura, you have a view?")).toEqual(["Anna: Thursday then. Laura, you have a view?"]);
  });

  it("gives one segment per line of the sample rundown", () => {
    const text = readFileSync(new URL("../../src/fixtures/rundowns/talkshow-01.txt", import.meta.url), "utf8");
    expect(segment(text)).toHaveLength(13);
  });
});
