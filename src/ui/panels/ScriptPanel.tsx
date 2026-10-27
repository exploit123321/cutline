import { useEffect, useRef, useState } from "react";
import { SAMPLES } from "../../fixtures/samples";
import { useShallow } from "zustand/react/shallow";
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
  // a shallow pick, so the playhead ticking does not re-render the rundown
  const { script, setScript, loadSample, provider, setProvider, parse, parsing, error, health, checkServer, rows, castNote } = useStore(
    useShallow((s) => ({
      script: s.script,
      setScript: s.setScript,
      loadSample: s.loadSample,
      provider: s.provider,
      setProvider: s.setProvider,
      parse: s.parse,
      parsing: s.parsing,
      error: s.error,
      health: s.health,
      checkServer: s.checkServer,
      rows: s.rows,
      castNote: s.castNote,
    })),
  );

  useEffect(() => {
    void checkServer();
  }, [checkServer]);

  const review = rows.filter((r) => r.needsReview).length;
  const blocked = provider !== "mock" && health !== null && !health[provider];

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 border-r border-line bg-elev p-4">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">Rundown</h2>
        <SampleMenu onPick={loadSample} />
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

      {castNote && (
        <p className="fade-up rounded-lg bg-accent-soft px-2.5 py-1.5 text-[12px] leading-snug text-fg-2">
          <span className="font-semibold text-accent">Cast </span>
          {castNote}
        </p>
      )}
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

/** "Load sample" opens a short menu: each sample rundown with the studio it is written for. */
function SampleMenu({ onPick }: { onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="btn btn-sm" aria-expanded={open}>
        Load sample
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          className="fade-up absolute right-0 top-9 z-40 w-64 rounded-xl p-1"
          style={{ background: "rgba(24,24,31,0.97)", boxShadow: "inset 0 0 0 1px var(--color-line-strong), 0 18px 40px -12px rgba(0,0,0,0.75)", animationDuration: "260ms" }}
        >
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setOpen(false);
                onPick(s.id);
              }}
              className="block w-full rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
            >
              <div className="text-[13px] font-semibold text-fg">{s.label}</div>
              <div className="text-[11.5px] leading-snug text-fg-3">{s.hint}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
