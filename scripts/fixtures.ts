import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { Fixture } from "../src/classify/eval";
import { podcast, talkshow } from "../src/fixtures/studios";
import { RowTypeSchema, ShotSchema } from "../src/model/schema";

const root = join(dirname(fileURLToPath(import.meta.url)), "../src/fixtures");
/** The rundowns, and the one-click samples that have hand labels next to them. */
const DIRS = ["rundowns", "samples"];
const STUDIOS = Object.fromEntries([talkshow, podcast].map((s) => [s.id, s]));

const ExpectedRow = z.object({ raw: z.string(), type: RowTypeSchema, speakerId: z.string().nullable(), shot: ShotSchema.nullable() });
// a plain list is written for the talk show; other casts name their studio
const ExpectedFile = z.union([
  z.array(ExpectedRow).transform((rows) => ({ studio: talkshow.id, rows })),
  z.object({ studio: z.string(), rows: z.array(ExpectedRow) }),
]);

export function loadRundownFixtures(): Fixture[] {
  return DIRS.flatMap((d) =>
    readdirSync(join(root, d))
      .filter((f) => f.endsWith(".txt") && existsSync(join(root, d, f.replace(/\.txt$/, ".expected.json"))))
      .sort()
      .map((f) => {
        const name = f.replace(/\.txt$/, "");
        const file = ExpectedFile.parse(JSON.parse(readFileSync(join(root, d, `${name}.expected.json`), "utf8")));
        const studio = STUDIOS[file.studio];
        if (!studio) throw new Error(`${name}: unknown studio "${file.studio}"`);
        return { name, studio, text: readFileSync(join(root, d, f), "utf8"), expected: file.rows };
      }),
  );
}

/** A director's brief (prose, "brief-*") rather than a scripted rundown: much harder to read. */
export const isBrief = (f: Fixture) => f.name.startsWith("brief-");
