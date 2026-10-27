import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { hasApiKey, modelName } from "./anthropic";
import { loadEnv } from "./env";
import { hasJevKey, jevModel } from "./jev";

loadEnv();
const port = Number(process.env.PORT ?? 8787);
const key = (set: boolean) => (set ? "key set" : "no key");
serve({ fetch: createApp().fetch, port }, () => {
  console.log(`cutline classifier on http://localhost:${port}`);
  console.log(`  jev  ${jevModel()}  ${key(hasJevKey())}`);
  console.log(`  llm  ${modelName()}  ${key(hasApiKey())}`);
});
