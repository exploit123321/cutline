import { z } from "zod";

export const Vec3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() });

export const PersonSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/, "ids are lowercase slugs"),
  name: z.string().min(1),
  aliases: z.array(z.string()),
  position: Vec3Schema,
  facingYaw: z.number(),
  eyeHeight: z.number().positive().max(2.5),
  /** shown on the lower-third, e.g. "Host"; without it the strap says Host or Guest from the aliases */
  role: z.string().optional(),
});

export const CameraSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  label: z.string().min(1),
  position: Vec3Schema,
  yaw: z.number(),
  pitch: z.number().min(-90).max(90),
  fovRange: z
    .tuple([z.number(), z.number()])
    .refine(([tight, wide]) => tight > 0 && wide < 180 && tight <= wide, {
      message: "fovRange must be [tightest, widest] with 0 < tightest <= widest < 180",
    }),
  fixed: z.boolean(),
});

export const PropSchema = z.object({
  preset: z.string(),
  position: Vec3Schema,
  yaw: z.number(),
});

export const StudioSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    people: z.array(PersonSchema).min(1),
    cameras: z.array(CameraSchema).min(1),
    props: z.array(PropSchema).default([]),
  })
  .refine((s) => new Set(s.people.map((p) => p.id)).size === s.people.length, {
    message: "person ids must be unique",
  })
  .refine((s) => new Set(s.cameras.map((c) => c.id)).size === s.cameras.length, {
    message: "camera ids must be unique",
  });

export const ROW_TYPES = ["dialogue", "action", "visual", "cut", "cue", "note"] as const;
export const SHOTS = ["close", "medium", "wide"] as const;
export const RowTypeSchema = z.enum(ROW_TYPES);
export const ShotSchema = z.enum(SHOTS);

const unit = z.number().min(0).max(1);

export const RowSchema = z.object({
  id: z.string(),
  index: z.number().int().nonnegative(),
  raw: z.string(),
  type: RowTypeSchema.nullable(),
  speakerId: z.string().nullable(),
  text: z.string(),
  shot: ShotSchema.nullable(),
  confidence: z.object({ type: unit, speakerId: unit, shot: unit }),
  needsReview: z.boolean(),
  invalid: z.array(z.enum(["type", "speakerId", "shot"])),
  locked: z.boolean(),
  cameraId: z.string().nullable(),
  fov: z.number().nullable(),
  start: z.number().nullable(),
  duration: z.number().nullable(),
  reason: z.string().nullable(),
});

export const ShowSchema = z.object({ studio: StudioSchema, rows: z.array(RowSchema) });
