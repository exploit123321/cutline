import { describe, expect, it } from "vitest";
import { CameraSchema, RowSchema, StudioSchema } from "../../src/model/schema";
import { talkshow } from "../../src/fixtures/studios";
import talkshowJson from "../../src/fixtures/studios/talkshow.json";

const goodCamera = {
  id: "cam1",
  label: "CAM 1",
  position: { x: 0, y: 1.5, z: 5 },
  yaw: 0,
  pitch: 0,
  fovRange: [10, 50],
  fixed: true,
};

describe("CameraSchema", () => {
  it("accepts a sane camera", () => {
    expect(CameraSchema.safeParse(goodCamera).success).toBe(true);
  });

  it.each([
    ["reversed range", [50, 10]],
    ["zero tightest", [0, 50]],
    ["negative", [-5, 40]],
    ["180 or wider", [10, 180]],
  ])("rejects a bad FOV range: %s", (_name, fovRange) => {
    expect(CameraSchema.safeParse({ ...goodCamera, fovRange }).success).toBe(false);
  });
});

describe("sample studio", () => {
  it("loads with three people and three cameras", () => {
    expect(talkshow.people.map((p) => p.id)).toEqual(["anna", "martins", "laura"]);
    expect(talkshow.cameras).toHaveLength(3);
  });

  it("rejects duplicate person ids", () => {
    const people = [talkshowJson.people[0], talkshowJson.people[0]];
    expect(StudioSchema.safeParse({ ...talkshowJson, people }).success).toBe(false);
  });
});

describe("RowSchema", () => {
  it("rejects confidence outside 0..1", () => {
    const row = {
      id: "r0",
      index: 0,
      raw: "x",
      type: "note",
      speakerId: null,
      text: "x",
      shot: null,
      confidence: { type: 1.2, speakerId: 1, shot: 1 },
      needsReview: false,
      invalid: [],
      locked: false,
      cameraId: null,
      fov: null,
      start: null,
      duration: null,
      reason: null,
    };
    expect(RowSchema.safeParse(row).success).toBe(false);
    expect(RowSchema.safeParse({ ...row, confidence: { type: 1, speakerId: 1, shot: 1 } }).success).toBe(true);
  });
});
