import { describe, expect, it } from "vitest";
import { castFit, chooseCast, detectCast } from "../../src/classify/cast";
import { podcast, talkshow } from "../../src/fixtures/studios";

const brief = `Maybe start with a wide shot of all three sitting together.
Alex starts? Something like “Alright, welcome back everyone”.
Camera 1 on Alex at the beginning, then switch to Jamie when responding.
Alex: “So, there's been a lot happening recently”
Jamie could say “Wait, can we actually pull that up for a second?”
Sam could jump in with “Yeah, but you're missing the important part”
Sam: “Hold on, that increase is actually way bigger than I expected.”
[GFX: chart]
Note: keep the corner box clear`;

describe("detectCast", () => {
  it("finds speaker prefixes and speech verbs, in order, and skips sentence words", () => {
    expect(detectCast(brief)).toEqual(["Alex", "Jamie", "Sam"]);
  });

  it("reads the talk-show sample's cast, initials included", () => {
    expect(detectCast("ANNA: hello\nM: hi\nLAURA - can I jump in here\n[CUE: break]")).toEqual(["Anna", "M", "Laura"]);
  });

  it("needs two mentions before a speech verb when there is no prefix", () => {
    expect(detectCast("Then Robin says hello.")).toEqual([]);
    expect(detectCast("Robin says hello. Later Robin asks why.")).toEqual(["Robin"]);
  });
});

describe("chooseCast", () => {
  it("keeps a studio whose cast covers the script", () => {
    expect(castFit(talkshow, ["Anna", "M", "Laura"])).toBe(1);
    expect(chooseCast(talkshow, ["Anna", "M", "Laura"], [talkshow, podcast]).kind).toBe("keep");
  });

  it("switches to the known studio that has the script's cast", () => {
    const c = chooseCast(talkshow, ["Alex", "Jamie", "Sam"], [talkshow, podcast]);
    expect(c.kind).toBe("switch");
    expect(c.kind === "switch" && c.studio.id).toBe("late-line");
  });

  it("puts unknown names on the current seats, keeping set and cameras", () => {
    const c = chooseCast(talkshow, ["Robin", "Kai"], [talkshow, podcast]);
    if (c.kind !== "recast") throw new Error(c.kind);
    expect(c.studio.people.map((p) => p.name)).toEqual(["Robin", "Kai", "Laura Ozola"]);
    expect(c.studio.people[0]?.position).toEqual(talkshow.people[0]?.position);
    expect(c.studio.cameras).toEqual(talkshow.cameras);
    expect(new Set(c.studio.people.map((p) => p.id)).size).toBe(3);
  });
});
