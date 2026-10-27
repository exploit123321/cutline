import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { hasApiKey, modelName } from "./anthropic";
import { loadEnv } from "./env";

loadEnv();
const port = Number(process.env.PORT ?? 8787);
serve({ fetch: createApp().fetch, port }, () => {
  console.log(`cutline classifier on http://localhost:${port}  model=${modelName()}  key=${hasApiKey() ? "set" : "MISSING"}`);
});
