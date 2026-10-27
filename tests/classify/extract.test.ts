import { describe, expect, it } from "vitest";
import { extractText, quotedText } from "../../src/classify/extract";

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

describe("quotes", () => {
  it.each([
    ["Alex: “So, there's been a lot happening recently”", "So, there's been a lot happening recently"],
    ['JAMIE: "Wait, click on that."', "Wait, click on that."],
    ["“Hello there.”", "Hello there."],
  ])("extractText drops the wrapping quotes: %s", (segment, text) => {
    expect(extractText(segment)).toBe(text);
  });

  it("quotedText takes the quoted words out of a sentence about them", () => {
    expect(quotedText("Jamie could say “Wait, can we actually pull that up for a second?” and then whoever is controlling the broadcast switches")).toBe(
      "Wait, can we actually pull that up for a second?",
    );
    expect(quotedText("Could add labels like “Before” and “After,” or something")).toBe("Before After");
    expect(quotedText("No quotes at all")).toBeNull();
  });
});
