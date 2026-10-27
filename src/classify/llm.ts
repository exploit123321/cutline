import type { ClassifyOne, RawClassification } from "./types";

/**
 * Browser side of the llm provider: one POST per segment to the local server, which
 * holds the API key. Errors propagate; the loop turns them into rows flagged red.
 */
export const llmClassifyOne: ClassifyOne = async ({ segment, context, studio }) => {
  const res = await fetch("/api/classify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ segment, context, studio }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `classifier server returned ${res.status}`);
  }
  return (await res.json()) as RawClassification;
};

export async function llmAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) return false;
    return Boolean(((await res.json()) as { llm?: boolean }).llm);
  } catch {
    return false;
  }
}
