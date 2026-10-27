import type { Plan } from "../../engine";
import type { Studio } from "../../model/types";
import { buildPerformance, buildScreens, type Performance, type ScreenSegment } from "../../show";

/** The plan object changes whenever rows or the studio change, so it is a safe cache key. */
const cache = new WeakMap<Plan, Performance>();

export function performanceOf(plan: Plan, studio: Studio): Performance {
  let perf = cache.get(plan);
  if (!perf) {
    perf = buildPerformance(plan, studio);
    cache.set(plan, perf);
  }
  return perf;
}

const screenCache = new WeakMap<Plan, ScreenSegment[]>();

export function screensOf(plan: Plan): ScreenSegment[] {
  let s = screenCache.get(plan);
  if (!s) {
    s = buildScreens(plan);
    screenCache.set(plan, s);
  }
  return s;
}
