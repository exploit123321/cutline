import type { ClassifyOne, RawClassification, ServerProvider } from "./types";

/**
 * Browser side of the jev and llm providers: one POST per segment to the local server,
 * which holds the API keys. Errors propagate; the loop turns them into rows flagged red.
 */
export function remoteClassifyOne(provider: ServerProvider): ClassifyOne {
  return async ({ segment, context, studio }) => {
    const t0 = performance.now();
    const res = await fetch(`/api/classify/${provider}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ segment, context, studio }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `classifier server returned ${res.status}`);
    }
    const raw = (await res.json()) as RawClassification;
    // round trip as the user feels it; model and cost come from the server when known
    return { ...raw, meta: { ...raw.meta, ms: Math.round(performance.now() - t0) } };
  };
}

export type ServerHealth = Record<ServerProvider, boolean>;

/** Which server providers have a key. Both false when the server is not running. */
export async function serverHealth(): Promise<ServerHealth> {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) return { jev: false, llm: false };
    const body = (await res.json()) as Partial<ServerHealth>;
    return { jev: Boolean(body.jev), llm: Boolean(body.llm) };
  } catch {
    return { jev: false, llm: false };
  }
}
