/**
 * Part-descriptor format for set dressing, kept compatible with the preset format
 * of the author's layout-editor project (see its MODELING_PROMPT.md):
 * `build()` returns parts `{ kind, c, s, r, color }` where
 *  - `c` is the part centre and `s` its size, both in MAP UNITS of 5 cm,
 *  - `r` is an Euler XYZ rotation in degrees,
 *  - the model faces -z (same as a yaw of 0) and stands on y = 0.
 */
export type PartKind = "box" | "cyl" | "sphere";
export type Triple = [number, number, number];

export type Part = {
  kind: PartKind;
  c: Triple;
  s: Triple;
  r: Triple;
  color: string;
};

export type Preset = {
  id: string;
  label: string;
  /** Where this preset came from; shown in docs/decisions.md. */
  source: string;
  build: () => Part[];
};

export function part(kind: PartKind, c: Triple, s: Triple, r: Triple, color: string): Part {
  return { kind, c, s, r, color };
}

/** Axis-aligned box standing on `yBottom`, the most common part. */
export function box(x: number, yBottom: number, z: number, w: number, h: number, d: number, color: string): Part {
  return part("box", [x, yBottom + h / 2, z], [w, h, d], [0, 0, 0], color);
}

/** Vertical cylinder standing on `yBottom`; `s` is [diameter, height, diameter]. */
export function cyl(x: number, yBottom: number, z: number, diameter: number, h: number, color: string): Part {
  return part("cyl", [x, yBottom + h / 2, z], [diameter, h, diameter], [0, 0, 0], color);
}
