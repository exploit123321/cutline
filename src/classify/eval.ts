import { REVIEW_THRESHOLD } from "../model/constants";
import type { Row, Studio } from "../model/types";
import { classifyAll } from "./loop";
import { segment } from "./segment";
import type { ClassifyOne } from "./types";

export type Expected = { raw: string; type: Row["type"]; speakerId: string | null; shot: Row["shot"] };
/** A rundown, the studio it is written for, and one hand label per segment. */
export type Fixture = { name: string; text: string; studio: Studio; expected: Expected[] };
export type Field = "type" | "speakerId" | "shot";
export const FIELDS: Field[] = ["type", "speakerId", "shot"];

/** One answer, and the score the review compared with REVIEW_THRESHOLD. */
export type Scored = { field: Field; score: number; ok: boolean; invalid: boolean };

/**
 * Score bands for the calibration table, top first. The edge at REVIEW_THRESHOLD splits
 * what the review flags (below) from what it lets through.
 */
export const BANDS: [number, number][] = [
  [0.97, 1],
  [0.9, 0.97],
  [REVIEW_THRESHOLD, 0.9],
  [0.5, REVIEW_THRESHOLD],
  [0, 0.5],
];
export type Band = { lo: number; hi: number; answers: number; right: number; meanScore: number };

/**
 * Is an answer scored 0.9 right about 9 times in 10? Answers grouped by their score, with
 * how many match the labels. Invalid fields are left out: their score is 0 by rule (red),
 * not a judgment from the provider.
 */
export function calibration(scored: Scored[]): Band[] {
  const valid = scored.filter((s) => !s.invalid);
  return BANDS.map(([lo, hi]) => {
    const inBand = valid.filter((s) => s.score >= lo && (hi === 1 ? s.score <= hi : s.score < hi));
    const sum = inBand.reduce((a, s) => a + s.score, 0);
    return { lo, hi, answers: inBand.length, right: inBand.filter((s) => s.ok).length, meanScore: inBand.length ? sum / inBand.length : 0 };
  });
}

/** Right answers the review flags anyway: each one costs a human a look for nothing. */
export function flaggedButRight(scored: Scored[]): number {
  return scored.filter((s) => s.ok && !s.invalid && s.score < REVIEW_THRESHOLD).length;
}

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
  /** every answer with its score, for the calibration table */
  scored: Scored[];
  byFixture: { name: string; total: number; correct: Record<Field, number> }[];
};

const show = (v: unknown) => (v === null || v === undefined ? "∅" : String(v));

/** Run every fixture through a provider and compare field by field with the hand labels. */
export async function evaluate(fixtures: Fixture[], classifyOne: ClassifyOne): Promise<EvalReport> {
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
  const scored: Scored[] = [];
  const byFixture: EvalReport["byFixture"] = [];
  let total = 0;
  // fixtures are independent, so they run in parallel; rows within one stay sequential (context)
  const results = await Promise.all(fixtures.map((fx) => classifyAll(segment(fx.text), fx.studio, timed)));
  for (const [k, fx] of fixtures.entries()) {
    const rows = results[k] ?? [];
    const mine = { name: fx.name, total: 0, correct: { type: 0, speakerId: 0, shot: 0 } };
    byFixture.push(mine);
    const n = Math.max(rows.length, fx.expected.length);
    for (let i = 0; i < n; i++) {
      const exp = fx.expected[i];
      const row = rows[i];
      if (!exp) continue;
      total++;
      mine.total++;
      if (!row || row.raw !== exp.raw) {
        mismatches.push({ fixture: fx.name, index: i, raw: exp.raw, field: "segment", expected: exp.raw, got: show(row?.raw), caught: false });
        continue;
      }
      for (const f of FIELDS) {
        const ok = row[f] === exp[f];
        const invalid = row.invalid.includes(f);
        scored.push({ field: f, score: row.confidence[f], ok, invalid });
        if (ok) {
          correct[f]++;
          mine.correct[f]++;
          continue;
        }
        const caught = invalid || row.confidence[f] < REVIEW_THRESHOLD;
        mismatches.push({ fixture: fx.name, index: i, raw: exp.raw, field: f, expected: show(exp[f]), got: show(row[f]), caught });
      }
    }
  }
  const accuracy = Object.fromEntries(FIELDS.map((f) => [f, total ? correct[f] / total : 0])) as Record<Field, number>;
  return { total, correct, accuracy, mismatches, calls, avgMs: calls ? totalMs / calls : 0, costUsd, model, scored, byFixture };
}

const pct = (n: number, of: number) => `${(of ? (n / of) * 100 : 0).toFixed(1)}%`;

/** The calibration table and the per-fixture accuracy, as report lines. */
function calibrationLines(r: EvalReport): string[] {
  const lines = ["", `  by fixture          rows   type    speaker  shot`];
  for (const fx of r.byFixture) {
    const cells = FIELDS.map((f) => pct(fx.correct[f], fx.total).padStart(6)).join("   ");
    lines.push(`    ${fx.name.padEnd(16)} ${String(fx.total).padStart(4)}  ${cells}`);
  }
  lines.push("", `  calibration, all fields (the review flags scores below ${REVIEW_THRESHOLD})`, "    score        answers   right    mean score");
  for (const b of calibration(r.scored)) {
    if (!b.answers) continue;
    const band = `${b.lo.toFixed(2)}-${b.hi.toFixed(2)}`;
    lines.push(`    ${band.padEnd(12)} ${String(b.answers).padStart(7)}   ${pct(b.right, b.answers).padStart(6)}   ${b.meanScore.toFixed(3)}`);
  }
  const invalid = r.scored.filter((s) => s.invalid).length;
  const perField = FIELDS.map((f) => `${f} ${flaggedButRight(r.scored.filter((s) => s.field === f))}`).join(", ");
  lines.push(`  flagged but right: ${flaggedButRight(r.scored)} (${perField})   invalid (red): ${invalid}`);
  return lines;
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
    ...calibrationLines(r),
  );
  lines.push("", r.mismatches.length ? `mismatches (${r.mismatches.length}):` : "no mismatches");
  for (const m of r.mismatches) {
    lines.push(`  ${m.caught ? "caught " : "SLIPPED"} ${m.fixture} #${m.index} ${m.field}: expected ${m.expected}, got ${m.got}   "${m.raw}"`);
  }
  return lines.join("\n");
}

/** One line per provider, for the comparison table at the top of a saved `--all` run. */
export function formatTable(reports: [string, EvalReport][]): string {
  const head = "| provider | type | speaker | shot | avg ms | cost | caught | slipped | flagged but right |\n|---|---|---|---|---|---|---|---|---|";
  const rows = reports.map(([name, r]) => {
    const caught = r.mismatches.filter((m) => m.caught).length;
    const cost = r.costUsd === null ? "n/a" : `$${r.costUsd.toFixed(6)}`;
    const acc = FIELDS.map((f) => pct(r.correct[f], r.total)).join(" | ");
    return `| ${name}${r.model ? ` (${r.model})` : ""} | ${acc} | ${Math.round(r.avgMs)} | ${cost} | ${caught} | ${r.mismatches.length - caught} | ${flaggedButRight(r.scored)} |`;
  });
  return [head, ...rows].join("\n");
}
