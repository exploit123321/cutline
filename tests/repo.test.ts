import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Every source file under these folders. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|css|json|txt)$/.test(f) ? [p] : [];
  });
}

describe("source files", () => {
  it("contain no control characters (a \b written through another language's string becomes U+0008)", () => {
    // tab, line feed and carriage return are the only control characters a source file needs
    const isBad = (code: number) => code < 32 && code !== 9 && code !== 10 && code !== 13;
    const bad = ["src", "server", "scripts", "tests"]
      .flatMap(files)
      .filter((f) => [...readFileSync(f, "utf8")].some((ch) => isBad(ch.charCodeAt(0))));
    expect(bad).toEqual([]);
  });
});
