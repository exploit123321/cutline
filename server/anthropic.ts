import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ClassifyRequest, LlmOutput } from "./prompt";
import { LlmOutputSchema, systemPrompt, userPrompt } from "./prompt";

export const DEFAULT_MODEL = "claude-opus-5-5";

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
  const response = await client.messages.parse({
    model: modelName(),
    max_tokens: 1024,
    system: systemPrompt(req.studio),
    messages: [{ role: "user", content: userPrompt(req.segment, req.context) }],
    // short labelling task: low effort keeps latency and cost down
    output_config: { effort: "low", format: zodOutputFormat(LlmOutputSchema) },
  });
  if (response.stop_reason === "refusal") throw new ClassifyError("model declined to classify this segment");
  if (response.stop_reason === "max_tokens") throw new ClassifyError("model output was cut off");
  const parsed = LlmOutputSchema.safeParse(response.parsed_output);
  if (!parsed.success) throw new ClassifyError(`model output failed validation: ${parsed.error.message}`);
  return parsed.data;
}
