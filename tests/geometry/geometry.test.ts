import { describe, expect, it } from "vitest";
import {
  fovForHeight,
  fovForShot,
  forward,
  frontality,
  groupHeight,
  headPosition,
  heightForFov,
  inView,
  lineSide,
  lookAngles,
  toCameraFrame,
  v,
} from "../../src/geometry";
import type { Camera, Person } from "../../src/model/types";
import { alice, bob, camA, camB, camX } from "./fixture";

const person = (facingYaw: number): Person => ({
  id: "p",
  name: "P",
  aliases: [],
  position: { x: 0, y: 0, z: 0 },
  facingYaw,
  eyeHeight: 1.2,
});

const camAt = (x: number, z: number, extra: Partial<Camera> = {}): Camera => ({
  id: "c",
  label: "C",
  position: { x, y: 1.2, z },
  yaw: 0,
  pitch: 0,
  fovRange: [10, 50],
  fixed: true,
  ...extra,
});

describe("coordinate conventions", () => {
  it("yaw 0 faces -z, yaw 90 faces -x (turns left), yaw -90 faces +x", () => {
    const f0 = forward(0);
    expect(f0.x).toBeCloseTo(0);
    expect(f0.z).toBeCloseTo(-1);
    expect(Math.round(forward(90).x)).toBe(-1);
    expect(Math.round(forward(-90).x)).toBe(1);
    expect(forward(0, 90).y).toBeCloseTo(1);
  });

  it("lookAngles inverts forward", () => {
    for (const yaw of [-150, -45, 0, 30, 120]) {
      for (const pitch of [-20, 0, 15]) {
        const f = forward(yaw, pitch);
        const a = lookAngles(v(0, 0, 0), f);
        expect(a.yaw).toBeCloseTo(yaw);
        expect(a.pitch).toBeCloseTo(pitch);
      }
    }
  });

  it("toCameraFrame puts a point straight ahead on -z", () => {
    const yaw = 37;
    const pitch = -12;
    const local = toCameraFrame(forward(yaw, pitch), yaw, pitch);
    expect(local.x).toBeCloseTo(0);
    expect(local.y).toBeCloseTo(0);
    expect(local.z).toBeCloseTo(-1);
  });
});

describe("headPosition", () => {
  it("adds eye height on y", () => {
    expect(headPosition({ ...alice, eyeHeight: 1.65 })).toEqual({ x: -1, y: 1.65, z: 0 });
  });
});

describe("frontality", () => {
  it("is 0 when the person faces the camera directly", () => {
    // person faces +z (yaw 180), camera straight ahead on +z
    expect(frontality(person(180), camAt(0, 5))).toBeCloseTo(0);
  });

  it("is 90 in profile and 180 from behind", () => {
    expect(frontality(person(180), camAt(5, 0))).toBeCloseTo(90);
    expect(frontality(person(180), camAt(0, -5))).toBeCloseTo(180);
  });

  it("ignores camera height", () => {
    expect(frontality(person(180), camAt(0, 5, { position: { x: 0, y: 4, z: 5 } }))).toBeCloseTo(0);
  });

  it("matches the hand-checked tiny studio", () => {
    // Alice faces (+1, +1); camB is at (+4, +4) from her → straight on
    expect(frontality(alice, camB)).toBeCloseTo(0);
    // camA is at (-2, +4) from Alice: angle between (1,1) and (-2,4) = 71.57°
    expect(frontality(alice, camA)).toBeCloseTo(71.565, 2);
    expect(frontality(bob, camA)).toBeCloseTo(0);
  });
});

describe("inView", () => {
  const fixed = camAt(0, 5); // looks down -z from z = 5 at eye height
  it("sees a point straight ahead", () => {
    expect(inView(fixed, v(0, 1.2, 0), 30)).toBe(true);
  });

  it("does not see behind the camera", () => {
    expect(inView(fixed, v(0, 1.2, 8), 30)).toBe(false);
  });

  it("uses the 16:9 aspect: wider horizontally than vertically", () => {
    // at 5 m and 30° vertical FOV: half height = 1.34 m, half width = 2.38 m
    expect(inView(fixed, v(0, 1.2 + 1.3, 0), 30)).toBe(true);
    expect(inView(fixed, v(0, 1.2 + 1.4, 0), 30)).toBe(false);
    expect(inView(fixed, v(2.3, 1.2, 0), 30)).toBe(true);
    expect(inView(fixed, v(2.5, 1.2, 0), 30)).toBe(false);
  });

  it("fixed cameras keep their yaw; operated cameras aim at the subject", () => {
    const side = v(6, 1.2, 0); // far off to the right
    expect(inView(fixed, side, 30)).toBe(false);
    expect(inView({ ...fixed, fixed: false }, side, 30)).toBe(true);
  });

  it("operated camera aimed at a target can still miss a second point", () => {
    const op = { ...fixed, fixed: false };
    expect(inView(op, v(4, 1.2, 0), 10, v(0, 1.2, 0))).toBe(false);
    expect(inView(op, v(0.2, 1.2, 0), 10, v(0, 1.2, 0))).toBe(true);
  });
});

describe("fovForShot", () => {
  const lens = camAt(0, 5, { fovRange: [10, 50] });

  it("returns the expected FOV for a known distance", () => {
    // medium = 1.1 m at 5 m: 2·atan(0.55/5) = 12.553°
    expect(fovForShot(lens, 5, "medium")).toBeCloseTo(12.553, 2);
    // wide = 3.0 m at 5 m: 2·atan(0.3) = 33.398°
    expect(fovForShot(lens, 5, "wide")).toBeCloseTo(33.398, 2);
  });

  it("round-trips with heightForFov", () => {
    expect(heightForFov(5, fovForHeight(5, 1.1))).toBeCloseTo(1.1);
  });

  it("clamps at the tight end", () => {
    // close = 0.5 m at 5 m would need 5.72°, lens stops at 10°
    expect(fovForShot(lens, 5, "close")).toBe(10);
  });

  it("clamps at the wide end", () => {
    // wide at 1 m would need 112°, lens stops at 50°
    expect(fovForShot(lens, 1, "wide")).toBe(50);
  });

  it("uses the group height when it is larger", () => {
    expect(fovForShot(lens, 5, "wide", 4)).toBeCloseTo(fovForHeight(5, 4));
    expect(fovForShot(lens, 5, "wide", 1)).toBeCloseTo(fovForHeight(5, 3));
  });
});

describe("groupHeight", () => {
  it("is zero for one person and grows with spread", () => {
    const op = { ...camAt(0, 6), fixed: false };
    expect(groupHeight(op, [v(0, 1.2, 0)])).toBe(0);
    const near = groupHeight(op, [v(-1, 1.2, 0), v(1, 1.2, 0)]);
    const far = groupHeight(op, [v(-2, 1.2, 0), v(2, 1.2, 0)]);
    // 2 m wide → 2/1.778 · 1.2 = 1.35 m
    expect(near).toBeCloseTo((2 / (16 / 9)) * 1.2, 1);
    expect(far).toBeGreaterThan(near);
  });
});

describe("lineSide", () => {
  const a = alice.position;
  const b = bob.position;

  it("flips when the point crosses the line", () => {
    expect(lineSide(a, b, v(0, 0, 1))).toBe(1);
    expect(lineSide(a, b, v(0, 0, -1))).toBe(-1);
    expect(lineSide(a, b, v(0, 0, 0))).toBe(0);
  });

  it("puts camA and camB on one side and camX on the other", () => {
    expect(lineSide(a, b, camA.position)).toBe(lineSide(a, b, camB.position));
    expect(lineSide(a, b, camX.position)).toBe(-lineSide(a, b, camB.position));
  });

  it("swapping a and b flips the sign", () => {
    expect(lineSide(b, a, camA.position)).toBe(-lineSide(a, b, camA.position));
  });
});
