import { REVIEW_THRESHOLD } from "../model/constants";
import type { Row, Studio } from "../model/types";
import { classifyAll } from "./loop";
import { segment } from "./segment";
import type { ClassifyOne } from "./types";

export type Expected = { raw: string; type: Row["type"]; speakerId: string | null; shot: Row["shot"] };
export type Fixture = { name: string; text: string; expected: Expected[] };
export type Field = "type" | "speakerId" | "shot";
export const FIELDS: Field[] = ["type", "speakerId", "shot"];

export type Mismatch = {
  fixture: string;
  index: number;
  raw: string;
  field: Field | "segment";
  expected: string;
  got: string;
  /** the wrong value was flagged for review (low confidence or invalid), so a human sees it */
  caught: boolean;
};
export type EvalReport = {
  total: number;
  correct: Record<Field, number>;
  accuracy: Record<Field, number>;
  mismatches: Mismatch[];
  calls: number;
  avgMs: number;
  /** null when the provider reports no cost */
  costUsd: number | null;
  model: string | null;
};

const show = (v: unknown) => (v === null || v === undefined ? "∅" : String(v));

/** Run every fixture through a provider and compare field by field with the hand labels. */
export async function evaluate(fixtures: Fixture[], studio: Studio, classifyOne: ClassifyOne): Promise<EvalReport> {
  let calls = 0;
  let totalMs = 0;
  let costUsd: number | null = null;
  let model: string | null = null;
  const timed: ClassifyOne = async (input) => {
    const t0 = performance.now();
    const raw = await classifyOne(input);
    calls++;
    totalMs += raw.meta?.ms ?? performance.now() - t0;
    if (typeof raw.meta?.costUsd === "number") costUsd = (costUsd ?? 0) + raw.meta.costUsd;
    model = raw.meta?.model ?? model;
    return raw;
  };

  const correct: Record<Field, number> = { type: 0, speakerId: 0, shot: 0 };
  const mismatches: Mismatch[] = [];
  let total = 0;
  // fixtures are independent, so they run in parallel; rows within one stay sequential (context)
  const results = await Promise.all(fixtures.map((fx) => classifyAll(segment(fx.text), studio, timed)));
  for (const [k, fx] of fixtures.entries()) {
    const rows = results[k] ?? [];
    const n = Math.max(rows.length, fx.expected.length);
    for (let i = 0; i < n; i++) {
      const exp = fx.expected[i];
      const row = rows[i];
      if (!exp) continue;
      total++;
      if (!row || row.raw !== exp.raw) {
        mismatches.push({ fixture: fx.name, index: i, raw: exp.raw, field: "segment", expected: exp.raw, got: show(row?.raw), caught: false });
        continue;
      }
      for (const f of FIELDS) {
        if (row[f] === exp[f]) {
          correct[f]++;
          continue;
        }
        const caught = row.invalid.includes(f) || row.confidence[f] < REVIEW_THRESHOLD;
        mismatches.push({ fixture: fx.name, index: i, raw: exp.raw, field: f, expected: show(exp[f]), got: show(row[f]), caught });
      }
    }
  }
  const accuracy = Object.fromEntries(FIELDS.map((f) => [f, total ? correct[f] / total : 0])) as Record<Field, number>;
  return { total, correct, accuracy, mismatches, calls, avgMs: calls ? totalMs / calls : 0, costUsd, model };
}

export function formatReport(r: EvalReport, provider: string): string {
  const caught = r.mismatches.filter((m) => m.caught).length;
  const lines = [`provider: ${provider}${r.model ? ` (${r.model})` : ""}   rows: ${r.total}`, ""];
  for (const f of FIELDS) {
    lines.push(`  ${f.padEnd(10)} ${(r.accuracy[f] * 100).toFixed(1).padStart(5)}%  (${r.correct[f]}/${r.total})`);
  }
  lines.push(
    "",
    `  calls ${r.calls}   avg latency ${Math.round(r.avgMs)} ms   total cost ${r.costUsd === null ? "n/a" : `$${r.costUsd.toFixed(6)}`}`,
    `  wrong answers: ${r.mismatches.length}   caught by review (< ${REVIEW_THRESHOLD} or invalid): ${caught}   slipped through: ${r.mismatches.length - caught}`,
  );
  lines.push("", r.mismatches.length ? `mismatches (${r.mismatches.length}):` : "no mismatches");
  for (const m of r.mismatches) {
    lines.push(`  ${m.caught ? "caught " : "SLIPPED"} ${m.fixture} #${m.index} ${m.field}: expected ${m.expected}, got ${m.got}   "${m.raw}"`);
  }
  return lines.join("\n");
}

/** One line per provider, for the comparison table at the top of a saved `--all` run. */
export function formatTable(reports: [string, EvalReport][]): string {
  const head = "| provider | type | speaker | shot | avg ms | cost | caught | slipped |\n|---|---|---|---|---|---|---|---|";
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const rows = reports.map(([name, r]) => {
    const caught = r.mismatches.filter((m) => m.caught).length;
    const cost = r.costUsd === null ? "n/a" : `$${r.costUsd.toFixed(6)}`;
    return `| ${name}${r.model ? ` (${r.model})` : ""} | ${pct(r.accuracy.type)} | ${pct(r.accuracy.speakerId)} | ${pct(r.accuracy.shot)} | ${Math.round(r.avgMs)} | ${cost} | ${caught} | ${r.mismatches.length - caught} |`;
  });
  return [head, ...rows].join("\n");
}
