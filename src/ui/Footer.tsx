import { useStore } from "../state/store";

const usd = (n: number) => (n < 0.01 ? `$${n.toFixed(6)}` : `$${n.toFixed(4)}`);

/** Speed and cost of the last parse. Jev reports tokens, so its cost is exact. */
export function Footer() {
  const stats = useStore((s) => s.stats);
  const provider = useStore((s) => s.provider);
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-ink-700 bg-ink-950 px-4 font-mono text-[11px] text-ink-400">
      <span>classifier: {provider}</span>
      {stats ? (
        <>
          {stats.model && <span>{stats.model}</span>}
          <span>{stats.calls} calls</span>
          <span>avg {Math.round(stats.totalMs / stats.calls)} ms/row</span>
          <span>last {stats.lastMs} ms</span>
          <span>cost {stats.costUsd === null ? "n/a" : usd(stats.costUsd)}</span>
        </>
      ) : (
        <span className="text-ink-500">{provider === "mock" ? "offline rules, no cost" : "parse to see latency and cost"}</span>
      )}
    </footer>
  );
}
