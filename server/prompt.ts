import { z } from "zod";
import { ROW_TYPES, SHOTS, StudioSchema } from "../src/model/schema";
import type { Studio } from "../src/model/types";
import type { ContextRow } from "../src/classify/types";

/** Request body for POST /api/classify. */
export const ClassifyRequestSchema = z.object({
  segment: z.string().min(1).max(4000),
  context: z
    .array(
      z.object({
        type: z.enum(ROW_TYPES).nullable(),
        speakerId: z.string().nullable(),
        text: z.string(),
        shot: z.enum(SHOTS).nullable(),
      }),
    )
    .max(10),
  studio: StudioSchema,
  onScreen: z.object({ text: z.string().max(4000), linesAgo: z.number().int().min(1) }).nullable().optional(),
});
export type ClassifyRequest = z.infer<typeof ClassifyRequestSchema>;

/**
 * Shape the model must answer with. This checks structure only: enum values and the
 * speaker id are plain strings here because the browser-side validate() checks each
 * field against the studio, so one bad field is nulled and flagged instead of the
 * whole row being thrown away. (The SDK turns zod enums into hints, not constraints.)
 */
export const LlmOutputSchema = z.object({
  type: z.string(),
  speakerId: z.string().nullable(),
  text: z.string(),
  shot: z.string().nullable(),
  confidence: z.object({ type: z.number(), speakerId: z.number(), shot: z.number() }),
});
export type LlmOutput = z.infer<typeof LlmOutputSchema>;

export function systemPrompt(studio: Studio): string {
  const people = studio.people
    .map((p) => `- id "${p.id}": ${p.name} (also called: ${p.aliases.join(", ") || "—"})`)
    .join("\n");
  return `You label lines from a live TV show rundown so a cut engine can plan camera shots.
You read text only. You never choose cameras or angles.

Classify ONE segment. Row types:
- dialogue: someone speaks on air. The speaker is the person talking.
- action: a person does something visible (laughs, turns, nods). speakerId = that person.
- visual: graphics, full-screen GFX, video playback, lower thirds.
- cut: a direction to change shot ("cut to", "back to", "close on", "[CUT TO WIDE]"). speakerId = the person the cut goes to, if any.
- cue: a production cue (open, music, bumper, break, SFX, titles).
- note: anything for the crew that is not on air.

"type" must be exactly one of: ${ROW_TYPES.join(", ")}.
"shot" must be exactly one of: ${SHOTS.join(", ")}, or null. Set it only when the text asks for a shot size; otherwise null.

People in this studio:
${people}

speakerId rules:
- Use one of the ids above when the person is in the list, matching names, aliases, initials and spellings without diacritics.
- If the speaker is clearly a person who is NOT in the list, return their name in lowercase as speakerId. It will be flagged for a human.
- Use null when no person is involved.
- For "she/he continues" and similar, use the previous rows to decide who it is, and lower your confidence.

"text" is the cleaned line without the speaker prefix or brackets.
"confidence" holds a number from 0 to 1 per field: how sure you are of type, speakerId and shot. Use below 0.7 when you are guessing.
Answer with the JSON object only.`;
}

export function userPrompt(segment: string, context: ContextRow[]): string {
  const ctx = context.length
    ? context.map((r, i) => `${i + 1}. [${r.type ?? "?"}] ${r.speakerId ?? "—"}: ${r.text}`).join("\n")
    : "(start of rundown)";
  return `Previous rows, oldest first:\n${ctx}\n\nSegment to classify:\n${segment}`;
}
