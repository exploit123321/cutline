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

/**
 * Thresholds for the brief questions. Above QUOTE_YES the line is dialogue and its text is
 * the quoted words; above ADVICE_YES it is an off-air note; between ADVICE_NO and
 * ADVICE_YES Jev is unsure, so the row is flagged for a human.
 */
export const QUOTE_YES = 0.7;
export const ADVICE_YES = 0.7;
export const ADVICE_NO = 0.3;

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
    // Two judgments, not one "speaks, acts, or gets the shot": on "ALEX: Jamie, what do you
    // think?" one question split between the speaker and the person named. jev.ts reads
    // `speaks` on dialogue and `subject` on every other row.
    speaks: choice("Who says the words in `line`?", {
      ...people,
      [NO_PERSON]: "Nobody in `cast`: the line has no words for a cast member to say on air.",
    }),
    subject: choice("Which cast member does `line` show on camera or describe doing something?", {
      ...people,
      [NO_PERSON]: "No single cast member: a graphic or a shared screen, music, a break, the whole group, or advice for the crew.",
    }),
    shot: choice("What shot size does `line` ask for?", {
      close: "A close-up: \"close on\", \"tight\", \"CU\".",
      medium: "A medium shot: \"medium\", \"mid shot\", \"MS\".",
      wide: "A wide shot of the studio or a group: \"wide\", \"WS\", \"establishing\".",
      [NO_SHOT]: "The line does not name a shot size.",
    }),
    // A brief mixes advice with the show itself; these two separate them (see jev.ts)
    general_advice: noul("Is `line` general advice about how the show should look or be made, rather than something placed at this point in the show?", {
      true: "Advice or a wish for the whole show: how transitions should feel, how big text should be, what to avoid, how the team should work.",
      false:
        'Something placed at this point in the running order: words someone says, a shot, a graphic or clip that comes up, or a cue, even when it is worded as a suggestion such as "maybe show the poll here".',
    }),
    quote_is_line: noul("Does `line` give, in quotes, words that a cast member says on air?", {
      true: "It quotes what a person in `cast` says, such as Jamie: “Wait, click on that.” or Jamie could say “Can we pull that up?”.",
      false: "It has no quoted words for a person in `cast` to say, or the quotes are labels, titles, or an example of what not to say.",
    }),
    unknown_speaker: noul("Does `line` name a speaker who is not in `cast`?", {
      true: "The line starts with a speaker name, such as \"PETER:\", that matches nobody in `cast`.",
      false: "The speaker is in `cast` under a name or alias, or the line names no speaker.",
    }),
  };
}

export type JevQuestions = ReturnType<typeof jevQuestions>;
