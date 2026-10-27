import { Hono } from "hono";
import { ClassifyRequestSchema, type ClassifyRequest, type LlmOutput } from "./prompt";
import { classifySegment, hasApiKey, modelName } from "./anthropic";

type Deps = {
  classify?: (req: ClassifyRequest) => Promise<LlmOutput>;
  hasKey?: () => boolean;
};

/** The app is built from injectable parts so tests can run it without a key or network. */
export function createApp({ classify = (r) => classifySegment(r), hasKey = hasApiKey }: Deps = {}) {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true, llm: hasKey(), model: modelName() }));

  app.post("/api/classify", async (c) => {
    if (!hasKey()) return c.json({ error: "ANTHROPIC_API_KEY is not set on the server (see .env.example)" }, 503);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "body must be JSON" }, 400);
    }
    const parsed = ClassifyRequestSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    try {
      return c.json(await classify(parsed.data));
    } catch (err) {
      const message = err instanceof Error ? err.message : "classification failed";
      return c.json({ error: message }, 502);
    }
  });

  return app;
}
