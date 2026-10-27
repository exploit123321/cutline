import { ASPECT, SHOT_HEIGHT } from "../model/constants";
import type { Camera, Person, Shot, Vec3 } from "../model/types";
import { DEG, centroid, forward, lookAngles, sub, toCameraFrame, toDeg, v } from "./vec";

export * from "./vec";

export function headPosition(person: Person): Vec3 {
  return v(person.position.x, person.position.y + person.eyeHeight, person.position.z);
}

export type Aim = { yaw: number; pitch: number };

/**
 * Where the camera points for a shot. Fixed cameras keep their own yaw/pitch;
 * operated cameras are assumed to pan and tilt onto the subject.
 */
export function aimAt(camera: Camera, target: Vec3): Aim {
  return camera.fixed ? { yaw: camera.yaw, pitch: camera.pitch } : lookAngles(camera.position, target);
}

/**
 * Is `point` inside the frustum of `camera` at vertical FOV `fov`, 16:9?
 * `target` is what an operated camera aims at; it defaults to the point itself.
 */
export function inView(camera: Camera, point: Vec3, fov: number, target: Vec3 = point): boolean {
  const aim = aimAt(camera, target);
  const local = toCameraFrame(sub(point, camera.position), aim.yaw, aim.pitch);
  const depth = -local.z;
  if (depth <= 1e-6) return false;
  const tanV = Math.tan((fov * DEG) / 2);
  const tanH = tanV * ASPECT;
  const eps = 1e-9;
  return Math.abs(local.y) / depth <= tanV + eps && Math.abs(local.x) / depth <= tanH + eps;
}

/**
 * Angle in degrees between where the person faces and the direction from them to
 * the camera, on the floor plane. 0 = straight on, 90 = profile, 180 = back of head.
 * Height is ignored on purpose: a camera slightly above eye line still sees the face.
 */
export function frontality(person: Person, camera: Camera): number {
  const f = forward(person.facingYaw);
  const dx = camera.position.x - person.position.x;
  const dz = camera.position.z - person.position.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-9) return 0;
  const cos = (f.x * dx + f.z * dz) / len;
  return toDeg(Math.acos(Math.max(-1, Math.min(1, cos))));
}

/** Vertical FOV that shows `visibleHeight` metres at distance `d`: h = 2·d·tan(fov/2). */
export function fovForHeight(d: number, visibleHeight: number): number {
  return 2 * toDeg(Math.atan(visibleHeight / (2 * Math.max(d, 1e-6))));
}

export function heightForFov(d: number, fov: number): number {
  return 2 * d * Math.tan((fov * DEG) / 2);
}

export function clampFov(camera: Camera, fov: number): number {
  const [tight, wide] = camera.fovRange;
  return Math.min(wide, Math.max(tight, fov));
}

/**
 * The vertical FOV that frames this shot size at this distance, clamped to the lens.
 * `groupHeight` is the visible height the people in shot need (already padded);
 * the larger of it and the shot size wins.
 */
export function fovForShot(camera: Camera, subjectDistance: number, shot: Shot, groupHeight = 0): number {
  return clampFov(camera, idealFov(subjectDistance, shot, groupHeight));
}

export function idealFov(subjectDistance: number, shot: Shot, groupHeight = 0): number {
  return fovForHeight(subjectDistance, Math.max(SHOT_HEIGHT[shot], groupHeight));
}

/**
 * Visible height needed to fit every point in frame, plus 20%, measured in the frame
 * of a camera aimed at their centroid. A 16:9 frame is limited by width more often
 * than height, so horizontal spread is converted to the equivalent height.
 */
export function groupHeight(camera: Camera, points: Vec3[]): number {
  if (points.length < 2) return 0;
  const c = centroid(points);
  const aim = aimAt(camera, c);
  const local = points.map((p) => toCameraFrame(sub(p, camera.position), aim.yaw, aim.pitch));
  const centreDepth = -toCameraFrame(sub(c, camera.position), aim.yaw, aim.pitch).z;
  // project onto the plane through the centroid so near/far people count correctly
  const proj = local.map((p) => {
    const k = centreDepth / Math.max(-p.z, 1e-6);
    return { x: p.x * k, y: p.y * k };
  });
  const xs = proj.map((p) => p.x);
  const ys = proj.map((p) => p.y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  // the projected span is measured from the centre line, so double the bigger half
  const halfX = Math.max(...xs.map(Math.abs));
  const halfY = Math.max(...ys.map(Math.abs));
  const needed = Math.max(spanY, 2 * halfY, spanX / ASPECT, (2 * halfX) / ASPECT);
  return needed * 1.2;
}

/**
 * Which side of the line a→b the point is on, on the floor (xz) plane:
 * sign of the 2D cross product of (b − a) and (point − a).
 */
export function lineSide(a: Vec3, b: Vec3, point: Vec3): -1 | 0 | 1 {
  const cross = (b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x);
  if (Math.abs(cross) < 1e-9) return 0;
  return cross > 0 ? 1 : -1;
}
