import type { Vec3 } from "../model/types";

export const DEG = Math.PI / 180;
export const toRad = (deg: number) => deg * DEG;
export const toDeg = (rad: number) => rad / DEG;

export const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, k: number): Vec3 => v(a.x * k, a.y * k, a.z * k);
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const length = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
export const distance = (a: Vec3, b: Vec3) => length(sub(a, b));

export function centroid(points: Vec3[]): Vec3 {
  if (points.length === 0) return v(0, 0, 0);
  return scale(points.reduce(add, v(0, 0, 0)), 1 / points.length);
}

/** Unit vector for a yaw/pitch pair. Yaw 0 faces -z, positive yaw turns left (CCW from above). */
export function forward(yawDeg: number, pitchDeg = 0): Vec3 {
  const y = toRad(yawDeg);
  const p = toRad(pitchDeg);
  return v(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
}

/** Inverse of forward(): the yaw/pitch that looks from `from` toward `to`. */
export function lookAngles(from: Vec3, to: Vec3): { yaw: number; pitch: number } {
  const d = sub(to, from);
  return {
    yaw: toDeg(Math.atan2(-d.x, -d.z)),
    pitch: toDeg(Math.atan2(d.y, Math.hypot(d.x, d.z))),
  };
}

/**
 * Express a world-space offset in the frame of a camera with this yaw/pitch:
 * x right, y up, -z forward (three.js camera convention).
 */
export function toCameraFrame(offset: Vec3, yawDeg: number, pitchDeg: number): Vec3 {
  const y = toRad(yawDeg);
  const p = toRad(pitchDeg);
  // undo yaw (rotation about y), then undo pitch (rotation about x)
  const x1 = offset.x * Math.cos(y) - offset.z * Math.sin(y);
  const z1 = offset.x * Math.sin(y) + offset.z * Math.cos(y);
  const y2 = offset.y * Math.cos(p) + z1 * Math.sin(p);
  const z2 = -offset.y * Math.sin(p) + z1 * Math.cos(p);
  return v(x1, y2, z2);
}
