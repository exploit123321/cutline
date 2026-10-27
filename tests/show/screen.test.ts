import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { classifyAll } from "../../src/classify/loop";
import { mockClassifyOne } from "../../src/classify/mock";
import { segment } from "../../src/classify/segment";
import { planShow, type Plan } from "../../src/engine";
import { podcast } from "../../src/fixtures/studios";
import { actionsOf, buildScreens, CORNER, screenAt, screenContent, SCREEN_IN } from "../../src/show";

const script = readFileSync(new URL("../../src/fixtures/samples/podcast-01.txt", import.meta.url), "utf8");
const podcastPlan = async (): Promise<Plan> => planShow({ studio: podcast, rows: await classifyAll(segment(script), podcast, mockClassifyOne) });
const rowStart = (plan: Plan, startsWith: string) => {
  const r = plan.rows.find((x) => x.text.startsWith(startsWith));
  if (!r || r.start === null || r.duration === null) throw new Error(startsWith);
  return r;
};

describe("screenContent", () => {
  it("reads kind, title and items from the pipe form", () => {
    expect(screenContent("poll | Should the night bus stay? | Yes 64 | No 21")).toEqual({
      kind: "poll",
      title: "Should the night bus stay?",
      items: ["Yes 64", "No 21"],
    });
    expect(screenContent("website | riverside-transit.example/night").kind).toBe("website");
  });

  it("reads plain graphics text too", () => {
    expect(screenContent("budget chart full screen")).toEqual({ kind: "chart", title: "Budget chart", items: [] });
  });
});

describe("actionsOf", () => {
  it("finds what a line does to the screen", () => {
    expect(actionsOf("Okay, so if you look right here")).toEqual(["zoom"]);
    expect(actionsOf("Wait, pause it there, go back a little")).toEqual(["pause", "rewind"]);
    expect(actionsOf("Wait, click on that")).toEqual(["click"]);
    expect(actionsOf("This?")).toEqual(["point"]);
    expect(actionsOf("Honestly? I think they underestimated it")).toEqual([]);
  });
});

describe("screen segments on the podcast sample", () => {
  it("opens one segment per visual and closes it at the next cut, cue or visual", async () => {
    const plan = await podcastPlan();
    const segs = buildScreens(plan);
    expect(segs.map((s) => s.content.kind)).toEqual(["split", "article", "chart", "clip", "website", "compare", "poll", "recap"]);
    // the split hands straight over to the article when Jamie asks to pull it up
    expect(segs[0]?.end).toBe(segs[1]?.start);
    // "back to wide on all three" ends the article
    expect(segs[1]?.end).toBe(rowStart(plan, "back to wide").start);
    for (const s of segs) expect(s.end).toBeGreaterThan(s.start);
  });

  it("slides in, keeps talk on the screen with the speaker known, and shows the studio for a laugh", async () => {
    const plan = await podcastPlan();
    const segs = buildScreens(plan);
    const chart = segs[2];
    if (!chart) throw new Error("no chart");
    expect(screenAt(segs, chart.start + SCREEN_IN / 2)?.enter).toBeGreaterThan(0);
    const alex = rowStart(plan, "If we actually take a look");
    const s = screenAt(segs, (alex.start as number) + 1);
    expect(s?.speakerId).toBe("alex");
    expect(s?.zoom).toBeGreaterThan(0);
    const laugh = rowStart(plan, "Jamie laughs");
    expect(screenAt(segs, (laugh.start as number) + 0.5)?.reaction).toBe(true);
  });

  it("circles the increase once Alex points at the numbers, and keeps it drawn", async () => {
    const plan = await podcastPlan();
    const segs = buildScreens(plan);
    const alex = rowStart(plan, "If we actually take a look");
    expect(screenAt(segs, (alex.start as number) - 0.1)?.highlight).toBe(0);
    expect(screenAt(segs, (alex.start as number) + 1)?.highlight).toBe(1);
    const sam = rowStart(plan, "Hold on, that increase");
    expect(screenAt(segs, (sam.start as number) + 1)?.highlight).toBe(1);
    const jamie = rowStart(plan, "Yeah, and that's why");
    expect(screenAt(segs, (jamie.start as number) + 1)?.highlight).toBe(1);
  });

  it("pauses the clip on 'pause it there' and steps it back on 'go back'", async () => {
    const plan = await podcastPlan();
    const segs = buildScreens(plan);
    const sam = rowStart(plan, "Wait, pause it there");
    const at = (dt: number) => screenAt(segs, (sam.start as number) + dt);
    expect(at(-0.1)?.paused).toBe(false);
    expect(at(0.1)?.paused).toBe(true);
    // stopped and then stepped back: later in the line the clip is earlier than at the pause
    expect((at(1.5)?.clipTime ?? 0) < (at(0.01)?.clipTime ?? 0)).toBe(true);
  });

  it("puts the squares where they do not cover the content", () => {
    expect(CORNER.chart).toBe("left");
    expect(CORNER.split).toBe("none");
    expect(CORNER.article).toBe("right");
  });

  it("is a pure function of t", async () => {
    const segs = buildScreens(await podcastPlan());
    const t = (segs[3]?.start ?? 0) + 2;
    expect(JSON.stringify(screenAt(segs, t))).toBe(JSON.stringify(screenAt(segs, t)));
  });
});
