import { useEffect } from "react";
import { useStore } from "../../state/store";
import type { ProviderId } from "../../classify";
import { RollingNumber } from "../motion/RollingNumber";
import { SegmentedControl } from "../motion/SegmentedControl";

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
    <section className="flex h-full min-h-0 flex-col gap-3 border-r border-line bg-elev p-4">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">Rundown</h2>
        <button onClick={loadSample} className="btn btn-sm">
          Load sample
        </button>
      </div>

      <textarea
        value={script}
        onChange={(e) => setScript(e.target.value)}
        spellCheck={false}
        placeholder={"Paste a rundown or script…\n\nANNA: good evening\n[GFX: headline]\ncut to wide"}
        className="input min-h-0 flex-1 resize-none p-3 font-mono text-[12px] leading-relaxed placeholder:text-fg-3"
      />

      <div>
        <div className="panel-title mb-1.5">Classifier</div>
        <SegmentedControl
          className="w-full justify-between"
          options={PROVIDERS.map((p) => ({
            ...p,
            dot: p.id === "mock" || health?.[p.id] ? "var(--color-ok)" : health ? "var(--color-fg-3)" : undefined,
          }))}
          value={provider}
          onChange={setProvider}
        />
        <p className="mt-1.5 text-[11px] text-fg-3">{PROVIDERS.find((p) => p.id === provider)?.hint}</p>
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
        className="btn btn-primary !h-9 w-full text-[13px]"
      >
        {parsing ? `Classifying ${parsing.done}/${parsing.total}…` : "Parse"}
      </button>

      {error && <p className="text-[11px] text-invalid">{error}</p>}
      {rows.length > 0 && (
        <p className="flex flex-wrap items-center gap-1 text-[11px] text-fg-3">
          <RollingNumber value={rows.length} className="font-semibold text-fg" /> rows ·
          <span className={`inline-flex items-center gap-1 ${review ? "text-review" : ""}`}>
            <RollingNumber value={review} className="font-semibold" /> need review
          </span>
          · locked rows survive re-parse
        </p>
      )}
    </section>
  );
}
