import type { z } from "zod";
import type {
  CameraSchema,
  PersonSchema,
  PropSchema,
  RowSchema,
  RowTypeSchema,
  ShotSchema,
  StudioSchema,
  Vec3Schema,
} from "./schema";

export type Vec3 = z.infer<typeof Vec3Schema>;
export type Person = z.infer<typeof PersonSchema>;
export type Camera = z.infer<typeof CameraSchema>;
export type Prop = z.infer<typeof PropSchema>;
export type Studio = z.infer<typeof StudioSchema>;
export type RowType = z.infer<typeof RowTypeSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type Row = z.infer<typeof RowSchema>;
export type Show = { studio: Studio; rows: Row[] };
export type ConfidenceField = keyof Row["confidence"];
