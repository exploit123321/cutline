import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Expected, Fixture } from "../src/classify/eval";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../src/fixtures/rundowns");

export function loadRundownFixtures(): Fixture[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .sort()
    .map((f) => {
      const name = f.replace(/\.txt$/, "");
      return {
        name,
        text: readFileSync(join(dir, f), "utf8"),
        expected: JSON.parse(readFileSync(join(dir, `${name}.expected.json`), "utf8")) as Expected[],
      };
    });
}
