import { describe, expect, it } from "vitest";
import { extractText } from "../../src/classify/extract";

describe("extractText", () => {
  it.each([
    ["ANNA: Labvakar and welcome", "Labvakar and welcome"],
    ["LAURA - can I jump in here", "can I jump in here"],
    ["Anna — we'll come back to that", "we'll come back to that"],
    ["M: look at the numbers", "look at the numbers"],
    ["[GFX: budget chart full screen]", "budget chart full screen"],
    ["[CUT TO WIDE]", "CUT TO WIDE"],
    ["she continues: and another thing", "and another thing"],
    ["Laura laughs", "Laura laughs"],
    ["cut to close on Laura", "cut to close on Laura"],
  ])("%s → %s", (segment, text) => {
    expect(extractText(segment)).toBe(text);
  });
});
