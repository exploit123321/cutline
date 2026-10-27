import { evaluate, formatReport } from "../src/classify/eval";
import { mockClassifyOne } from "../src/classify/mock";
import type { ClassifyOne } from "../src/classify/types";
import { talkshow } from "../src/fixtures/studios";
import { classifySegment, hasApiKey, modelName } from "../server/anthropic";
import { loadEnv } from "../server/env";
import { loadRundownFixtures } from "./fixtures";

// usage: npm run eval [-- --provider mock|llm]
loadEnv();
const arg = process.argv.indexOf("--provider");
const provider = arg >= 0 ? process.argv[arg + 1] : "mock";

let classifyOne: ClassifyOne;
if (provider === "mock") {
  classifyOne = mockClassifyOne;
} else if (provider === "llm") {
  if (!hasApiKey()) {
    console.error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add a key.");
    process.exit(2);
  }
  // talks to Anthropic directly; same prompt and validation as the server
  classifyOne = (input) => classifySegment(input);
} else {
  console.error(`unknown provider "${provider}" (use mock or llm)`);
  process.exit(2);
}

const report = await evaluate(loadRundownFixtures(), talkshow, classifyOne);
console.log(formatReport(report, provider === "llm" ? `llm (${modelName()})` : "mock"));
