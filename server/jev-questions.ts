import { choice, noul } from "@typesafe-ai/sdk";
import type { ContextRow } from "../src/classify/types";
import type { Studio } from "../src/model/types";

/**
 * Every word Jev sees lives in this file: the state layout, the questions, the options
 * and their criteria. Code in jev.ts turns the answers into row fields.
 */

/** The option Jev picks when the line is about nobody in the cast. */
export const NO_PERSON = "none";
/** The option Jev picks when the line asks for no shot size. */
export const NO_SHOT = "unspecified";

export function jevState(segment: string, context: ContextRow[], studio: Studio) {
  return {
    show: "A rundown for a live TV talk show. Each line is one beat: someone speaks, acts, or the crew gets a direction.",
    cast: Object.fromEntries(
      studio.people.map((p) => [p.id, `${p.name}${p.aliases.length ? `, also written as ${p.aliases.join(", ")}` : ""}`]),
    ),
    // an empty list can read as a signal, so the first line says so in words
    previous_lines: context.length
      ? context.map((r) => `${r.type ?? "?"} | ${r.speakerId ?? "nobody"} | ${r.text}`)
      : "This is the first line of the rundown.",
    line: segment,
  };
}

export function jevQuestions(studio: Studio) {
  const people = Object.fromEntries(
    studio.people.map((p) => [
      p.id,
      `${p.name} (cast id ${p.id}; also written as ${[p.name.split(/\s+/)[0], ...p.aliases].join(", ")})`,
    ]),
  );
  return {
    type: choice("What kind of beat is `line`?", {
      dialogue: "Someone speaks on air. The line is their words, often after a name prefix such as \"ANNA:\".",
      action: "A person does something visible without speaking, such as laughs, turns or nods.",
      visual: "Graphics or video on screen: full-screen GFX, charts, lower thirds, video playback, a shared screen (article, website, poll).",
      cut: "A direction to change the camera shot, such as \"cut to\", \"back to\", \"close on\" or \"[CUT TO WIDE]\".",
      cue: "A production cue such as the show open, music, a bumper, a break, sound effects or titles.",
      note: "A note for the crew that is not seen or heard on air.",
    }),
    speaker: choice("Which cast member is `line` about: the one who speaks, acts, or gets the shot?", {
      ...people,
      [NO_PERSON]: "No cast member: graphics, music, breaks, crew notes, or a shot of the whole studio.",
    }),
    shot: choice("What shot size does `line` ask for?", {
      close: "A close-up: \"close on\", \"tight\", \"CU\".",
      medium: "A medium shot: \"medium\", \"mid shot\", \"MS\".",
      wide: "A wide shot of the studio or a group: \"wide\", \"WS\", \"establishing\".",
      [NO_SHOT]: "The line does not name a shot size.",
    }),
    unknown_speaker: noul("Does `line` name a speaker who is not in `cast`?", {
      true: "The line starts with a speaker name, such as \"PETER:\", that matches nobody in `cast`.",
      false: "The speaker is in `cast` under a name or alias, or the line names no speaker.",
    }),
  };
}

export type JevQuestions = ReturnType<typeof jevQuestions>;
