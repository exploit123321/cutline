import type { Camera, Person, Studio } from "../../src/model/types";

/**
 * Tiny hand-checkable studio: two people 2 m apart on the x axis, facing each other
 * and turned 45° toward the audience (+z). Cameras:
 *  - camA at (-3, 1.2, 4): front-left, sees B's face
 *  - camB at ( 3, 1.2, 4): front-right, sees A's face
 *  - camX at ( 3, 1.2, -4): behind the line, sees A's face but crosses the 180° line
 */
export const alice: Person = {
  id: "a",
  name: "Alice",
  aliases: ["Alice"],
  position: { x: -1, y: 0, z: 0 },
  facingYaw: -135, // faces (+x, +z)
  eyeHeight: 1.2,
};

export const bob: Person = {
  id: "b",
  name: "Bob",
  aliases: ["Bob"],
  position: { x: 1, y: 0, z: 0 },
  facingYaw: 135, // faces (-x, +z)
  eyeHeight: 1.2,
};

const cam = (id: string, x: number, z: number, extra: Partial<Camera> = {}): Camera => ({
  id,
  label: id.toUpperCase(),
  position: { x, y: 1.2, z },
  yaw: 0,
  pitch: 0,
  fovRange: [5, 60],
  fixed: false,
  ...extra,
});

export const camA = cam("cama", -3, 4);
export const camB = cam("camb", 3, 4);
export const camX = cam("camx", 3, -4);

export const tiny: Studio = {
  id: "tiny",
  name: "tiny",
  people: [alice, bob],
  cameras: [camA, camB, camX],
  props: [],
};
