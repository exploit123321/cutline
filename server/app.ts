import { Hono } from "hono";
import type { RawClassification, ServerProvider } from "../src/classify/types";
import { ClassifyRequestSchema, type ClassifyRequest } from "./prompt";
import { classifySegment, hasApiKey, modelName } from "./anthropic";
import { hasJevKey, jevClassifySegment, jevModel } from "./jev";

type Provider = {
  classify: (req: ClassifyRequest) => Promise<RawClassification>;
  hasKey: () => boolean;
  model: () => string;
  keyName: string;
};

const DEFAULTS: Record<ServerProvider, Provider> = {
  jev: { classify: (r) => jevClassifySegment(r), hasKey: hasJevKey, model: jevModel, keyName: "TYPESAFE_API_KEY" },
  llm: { classify: (r) => classifySegment(r), hasKey: hasApiKey, model: modelName, keyName: "ANTHROPIC_API_KEY" },
};

const isProvider = (p: string): p is ServerProvider => p === "jev" || p === "llm";

/** The app is built from injectable parts so tests can run it without a key or network. */
export function createApp(overrides: Partial<Record<ServerProvider, Partial<Provider>>> = {}) {
  const providers = {
    jev: { ...DEFAULTS.jev, ...overrides.jev },
    llm: { ...DEFAULTS.llm, ...overrides.llm },
  };
  const app = new Hono();

  app.get("/api/health", (c) =>
    c.json({
      ok: true,
      jev: providers.jev.hasKey(),
      llm: providers.llm.hasKey(),
      models: { jev: providers.jev.model(), llm: providers.llm.model() },
    }),
  );

  app.post("/api/classify/:provider", async (c) => {
    const id = c.req.param("provider");
    if (!isProvider(id)) return c.json({ error: `unknown provider "${id}"` }, 404);
    const p = providers[id];
    if (!p.hasKey()) return c.json({ error: `${p.keyName} is not set on the server (see .env.example)` }, 503);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "body must be JSON" }, 400);
    }
    const parsed = ClassifyRequestSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid request", issues: parsed.error.issues }, 400);
    try {
      return c.json(await p.classify(parsed.data));
    } catch (err) {
      const message = err instanceof Error ? err.message : "classification failed";
      return c.json({ error: message }, 502);
    }
  });

  return app;
}
