import type { Part, PartKind, Preset, Triple } from "./format";

/** One map unit is 5 cm. Everything outside this folder works in metres. */
export const MAP_UNIT_M = 0.05;

export type MetricPart = {
  kind: PartKind;
  position: Triple; // metres
  size: Triple; // metres
  rotation: Triple; // radians, Euler XYZ
  color: string;
};

const DEG = Math.PI / 180;

export function toMetric(p: Part): MetricPart {
  return {
    kind: p.kind,
    position: [p.c[0] * MAP_UNIT_M, p.c[1] * MAP_UNIT_M, p.c[2] * MAP_UNIT_M],
    size: [p.s[0] * MAP_UNIT_M, p.s[1] * MAP_UNIT_M, p.s[2] * MAP_UNIT_M],
    rotation: [p.r[0] * DEG, p.r[1] * DEG, p.r[2] * DEG],
    color: p.color,
  };
}

const cache = new Map<string, MetricPart[]>();

/** Builders are pure, so their metric output is cached per preset id. */
export function buildMetric(preset: Preset): MetricPart[] {
  const hit = cache.get(preset.id);
  if (hit) return hit;
  const parts = preset.build().map(toMetric);
  cache.set(preset.id, parts);
  return parts;
}

/** Axis-aligned bounds in metres, ignoring rotation (good enough for placement checks). */
export function boundsOf(parts: MetricPart[]): { min: Triple; max: Triple } {
  const min: Triple = [Infinity, Infinity, Infinity];
  const max: Triple = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i] as number, (p.position[i] as number) - (p.size[i] as number) / 2);
      max[i] = Math.max(max[i] as number, (p.position[i] as number) + (p.size[i] as number) / 2);
    }
  }
  return { min, max };
}
