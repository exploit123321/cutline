import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { ClassifyRequest, LlmOutput } from "./prompt";
import { LlmOutputSchema, systemPrompt, userPrompt } from "./prompt";

export const DEFAULT_MODEL = "claude-opus-5-5";

/** Models that accept the server-side refusal fallback; other overrides run without it. */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

export function modelName(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export class ClassifyError extends Error {}

/**
 * One segment in, one validated classification out. The SDK enforces the JSON
 * schema; LlmOutputSchema is checked again here so nothing unvalidated leaves the server.
 */
export async function classifySegment(req: ClassifyRequest, client: Anthropic = new Anthropic()): Promise<LlmOutput> {
  const model = modelName();
  const fallback = FALLBACK_MODELS.has(model)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};
  const response = await client.beta.messages.parse({
    model,
    // thinking is always on for current Opus models; leave room for it at low effort
    max_tokens: 4096,
    // if a safety classifier declines, the API retries on a suitable fallback model
    ...fallback,
    system: systemPrompt(req.studio),
    messages: [{ role: "user", content: userPrompt(req.segment, req.context) }],
    // short labelling task: low effort keeps latency and cost down
    output_config: { effort: "low", format: betaZodOutputFormat(LlmOutputSchema) },
  });
  if (response.stop_reason === "refusal") throw new ClassifyError("model declined to classify this segment");
  if (response.stop_reason === "max_tokens") throw new ClassifyError("model output was cut off");
  const parsed = LlmOutputSchema.safeParse(response.parsed_output);
  if (!parsed.success) throw new ClassifyError(`model output failed validation: ${parsed.error.message}`);
  return parsed.data;
}
