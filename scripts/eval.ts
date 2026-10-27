import { mkdirSync, writeFileSync } from "node:fs";
import { evaluate, formatReport, formatTable, type EvalReport } from "../src/classify/eval";
import { mockClassifyOne } from "../src/classify/mock";
import type { ClassifyOne, ProviderId } from "../src/classify/types";
import { classifySegment, hasApiKey } from "../server/anthropic";
import { loadEnv } from "../server/env";
import { hasJevKey, jevClassifySegment } from "../server/jev";
import { loadRundownFixtures } from "./fixtures";

// usage: npm run eval [-- --provider mock|jev|llm] [-- --all]
loadEnv();
const all = process.argv.includes("--all");
const arg = process.argv.indexOf("--provider");
const chosen = arg >= 0 ? process.argv[arg + 1] : "mock";

// server-side functions directly: same questions, prompt and validation as the HTTP server
const PROVIDERS: Record<ProviderId, { one: ClassifyOne; ready: () => boolean; key?: string }> = {
  mock: { one: mockClassifyOne, ready: () => true },
  jev: { one: (input) => jevClassifySegment(input), ready: hasJevKey, key: "TYPESAFE_API_KEY" },
  llm: { one: (input) => classifySegment(input), ready: hasApiKey, key: "ANTHROPIC_API_KEY" },
};
const isProvider = (p: string | undefined): p is ProviderId => p === "mock" || p === "jev" || p === "llm";

let names: ProviderId[];
if (all) {
  names = (["mock", "jev", "llm"] as const).filter((p) => {
    if (PROVIDERS[p].ready()) return true;
    console.warn(`skipping ${p}: ${PROVIDERS[p].key} is not set`);
    return false;
  });
} else if (isProvider(chosen)) {
  if (!PROVIDERS[chosen].ready()) {
    console.error(`${PROVIDERS[chosen].key} is not set. Copy .env.example to .env and add a key.`);
    process.exit(2);
  }
  names = [chosen];
} else {
  console.error(`unknown provider "${chosen}" (use mock, jev or llm)`);
  process.exit(2);
}

const fixtures = loadRundownFixtures();
const reports: [string, EvalReport][] = [];
for (const name of names) {
  const report = await evaluate(fixtures, PROVIDERS[name].one);
  console.log(formatReport(report, name), "\n");
  reports.push([name, report]);
}

const table = formatTable(reports);
console.log(table);
const stamp = new Date().toISOString().replace(/:/g, "-").slice(0, 19);
const file = `docs/eval/${stamp}-${names.join("-")}.md`;
mkdirSync("docs/eval", { recursive: true });
const body = reports.map(([n, r]) => "```\n" + formatReport(r, n) + "\n```").join("\n\n");
writeFileSync(file, `# Eval ${stamp}\n\nFixtures: ${fixtures.map((f) => f.name).join(", ")}\n\n${table}\n\n${body}\n`);
console.log(`\nsaved ${file}`);
