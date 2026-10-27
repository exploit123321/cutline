import { useEffect } from "react";
import { useStore } from "../../state/store";
import type { ProviderId } from "../../classify";

const PROVIDERS: { id: ProviderId; label: string; hint: string }[] = [
  { id: "jev", label: "Jev", hint: "TypeSafe, calibrated" },
  { id: "mock", label: "Mock", hint: "rules, offline" },
  { id: "llm", label: "LLM", hint: "Claude, comparison" },
];

const KEY_NAME = { jev: "TYPESAFE_API_KEY", llm: "ANTHROPIC_API_KEY" } as const;

export function ScriptPanel() {
  const { script, setScript, loadSample, provider, setProvider, parse, parsing, error, health, checkServer, rows } = useStore();

  useEffect(() => {
    void checkServer();
  }, [checkServer]);

  const review = rows.filter((r) => r.needsReview).length;
  const blocked = provider !== "mock" && health !== null && !health[provider];

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 border-r border-ink-700 bg-ink-900 p-4">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">Rundown</h2>
        <button
          onClick={loadSample}
          className="rounded border border-ink-600 px-2 py-1 text-xs text-ink-200 hover:border-ink-400 hover:text-ink-100"
        >
          Load sample
        </button>
      </div>

      <textarea
        value={script}
        onChange={(e) => setScript(e.target.value)}
        spellCheck={false}
        placeholder={"Paste a rundown or script…\n\nANNA: good evening\n[GFX: headline]\ncut to wide"}
        className="min-h-0 flex-1 resize-none rounded border border-ink-700 bg-ink-950 p-3 font-mono text-[12px] leading-relaxed text-ink-100 outline-none placeholder:text-ink-500 focus:border-ink-500"
      />

      <div>
        <div className="panel-title mb-1.5">Classifier</div>
        <div className="grid grid-cols-3 gap-1 rounded border border-ink-700 bg-ink-950 p-1">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              className={`rounded px-2 py-1.5 text-left transition-colors ${
                provider === p.id ? "bg-ink-700 text-ink-100" : "text-ink-400 hover:text-ink-200"
              }`}
            >
              <div className="text-xs font-semibold">{p.label}</div>
              <div className="text-[10px] text-ink-400">{p.hint}</div>
            </button>
          ))}
        </div>
        {blocked && (
          <p className="mt-2 text-[11px] leading-snug text-review">
            Classifier server not reachable or no key. Run <code className="font-mono">npm run server</code> with{" "}
            <code className="font-mono">{KEY_NAME[provider]}</code> in <code className="font-mono">.env</code>.{" "}
            <button className="underline" onClick={() => void checkServer()}>
              Retry
            </button>
          </p>
        )}
      </div>

      <button
        onClick={() => void parse()}
        disabled={!script.trim() || parsing !== null || blocked}
        className="rounded bg-ink-100 py-2 text-sm font-semibold text-ink-950 transition-opacity hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {parsing ? `Classifying ${parsing.done}/${parsing.total}…` : "Parse"}
      </button>

      {error && <p className="text-[11px] text-invalid">{error}</p>}
      {rows.length > 0 && (
        <p className="text-[11px] text-ink-400">
          {rows.length} rows · <span className={review ? "text-review" : ""}>{review} need review</span> · locked rows survive re-parse
        </p>
      )}
    </section>
  );
}
