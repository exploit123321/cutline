import { describe, expect, it } from "vitest";
import { timecode } from "../../src/ui/format";

describe("timecode", () => {
  it("formats seconds as HH:MM:SS:FF at 25 fps", () => {
    expect(timecode(0)).toBe("00:00:00:00");
    expect(timecode(12.8)).toBe("00:00:12:20");
    expect(timecode(3725.04)).toBe("01:02:05:01");
  });

  it("never goes negative", () => {
    expect(timecode(-3)).toBe("00:00:00:00");
  });
});
