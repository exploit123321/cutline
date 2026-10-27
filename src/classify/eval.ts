import type { Row, Studio } from "../model/types";
import { classifyAll } from "./loop";
import { segment } from "./segment";
import type { ClassifyOne } from "./types";

export type Expected = { raw: string; type: Row["type"]; speakerId: string | null; shot: Row["shot"] };
export type Fixture = { name: string; text: string; expected: Expected[] };
export type Field = "type" | "speakerId" | "shot";
export const FIELDS: Field[] = ["type", "speakerId", "shot"];

export type Mismatch = { fixture: string; index: number; raw: string; field: Field | "segment"; expected: string; got: string };
export type EvalReport = {
  total: number;
  correct: Record<Field, number>;
  accuracy: Record<Field, number>;
  mismatches: Mismatch[];
};

const show = (v: unknown) => (v === null || v === undefined ? "∅" : String(v));

/** Run every fixture through a provider and compare field by field with the hand labels. */
export async function evaluate(fixtures: Fixture[], studio: Studio, classifyOne: ClassifyOne): Promise<EvalReport> {
  const correct: Record<Field, number> = { type: 0, speakerId: 0, shot: 0 };
  const mismatches: Mismatch[] = [];
  let total = 0;
  for (const fx of fixtures) {
    const segments = segment(fx.text);
    const rows = await classifyAll(segments, studio, classifyOne);
    const n = Math.max(rows.length, fx.expected.length);
    for (let i = 0; i < n; i++) {
      const exp = fx.expected[i];
      const row = rows[i];
      if (!exp) continue;
      total++;
      if (!row || row.raw !== exp.raw) {
        mismatches.push({ fixture: fx.name, index: i, raw: exp.raw, field: "segment", expected: exp.raw, got: show(row?.raw) });
        continue;
      }
      for (const f of FIELDS) {
        if (row[f] === exp[f]) correct[f]++;
        else mismatches.push({ fixture: fx.name, index: i, raw: exp.raw, field: f, expected: show(exp[f]), got: show(row[f]) });
      }
    }
  }
  const accuracy = Object.fromEntries(FIELDS.map((f) => [f, total ? correct[f] / total : 0])) as Record<Field, number>;
  return { total, correct, accuracy, mismatches };
}

export function formatReport(r: EvalReport, provider: string): string {
  const lines = [`provider: ${provider}   rows: ${r.total}`, ""];
  for (const f of FIELDS) {
    lines.push(`  ${f.padEnd(10)} ${(r.accuracy[f] * 100).toFixed(1).padStart(5)}%  (${r.correct[f]}/${r.total})`);
  }
  lines.push("", r.mismatches.length ? `mismatches (${r.mismatches.length}):` : "no mismatches");
  for (const m of r.mismatches) {
    lines.push(`  ${m.fixture} #${m.index} ${m.field}: expected ${m.expected}, got ${m.got}   "${m.raw}"`);
  }
  return lines.join("\n");
}
