import { describe, expect, it } from "vitest";
import { classifyAll } from "../../src/classify/loop";
import { mockClassifyOne } from "../../src/classify/mock";
import { planShow } from "../../src/engine";
import { talkshow } from "../../src/fixtures/studios";
import { rowsToCsv } from "../../src/state/csv";
import { applyEdit } from "../../src/state/edit";

describe("applyEdit", () => {
  it("locks the row and confirms the edited field", async () => {
    const [row] = await classifyAll(["PETERIS: hello"], talkshow, mockClassifyOne);
    expect(row).toMatchObject({ invalid: ["speakerId"], needsReview: true });
    const edited = applyEdit(row!, { field: "speakerId", value: "laura" });
    expect(edited).toMatchObject({ speakerId: "laura", locked: true, invalid: [], needsReview: false });
    expect(edited.confidence.speakerId).toBe(1);
  });

  it("a camera edit sticks through the engine; the FOV is re-framed for it", async () => {
    const rows = await classifyAll(["ANNA: a line long enough to hold a shot on its own"], talkshow, mockClassifyOne);
    const before = planShow({ studio: talkshow, rows }).rows[0]!;
    expect(before.cameraId).toBe("cam3");
    const edited = applyEdit(rows[0]!, { field: "cameraId", value: "cam1" });
    const after = planShow({ studio: talkshow, rows: [edited] }).rows[0]!;
    expect(after.cameraId).toBe("cam1");
    expect(after.fov).toBeGreaterThan(0);
    expect(after.reason).toMatch(/Locked/);
  });

  it("a duration edit sticks and moves later rows", async () => {
    const rows = await classifyAll(["ANNA: one two three four five", "[CUE: sting]"], talkshow, mockClassifyOne);
    const edited = [applyEdit(rows[0]!, { field: "duration", value: 9 }), rows[1]!];
    expect(planShow({ studio: talkshow, rows: edited }).rows.map((r) => r.start)).toEqual([0, 9]);
  });
});

describe("rowsToCsv", () => {
  it("writes a header and escapes commas and quotes", async () => {
    const rows = await classifyAll(['ANNA: well, "that" is it'], talkshow, mockClassifyOne);
    const csv = rowsToCsv(planShow({ studio: talkshow, rows }).rows, talkshow);
    const [head, line] = csv.split("\n");
    expect(head).toMatch(/^#,type,speaker,text/);
    expect(line).toContain('"well, ""that"" is it"');
    expect(line).toContain("Anna Bērziņa");
    expect(line).toContain("CAM 3");
  });
});
