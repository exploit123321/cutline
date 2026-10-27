import { useStore } from "../state/store";
import { RollingNumber } from "./motion/RollingNumber";

const usd = (n: number) => (n < 0.01 ? n.toFixed(6) : n.toFixed(4));

/** Speed and cost of the last parse. Jev reports tokens, so its cost is exact. */
export function Footer() {
  const stats = useStore((s) => s.stats);
  const provider = useStore((s) => s.provider);
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-bg px-4 text-[11px] text-fg-3">
      <span>
        classifier <span className="font-semibold text-fg-2">{provider}</span>
      </span>
      {stats ? (
        <>
          {stats.model && <span className="font-mono text-fg-2">{stats.model}</span>}
          <span className="flex items-center gap-1">
            <RollingNumber value={stats.calls} className="text-fg-2" /> calls
          </span>
          <span className="flex items-center gap-1">
            avg <RollingNumber value={Math.round(stats.totalMs / stats.calls)} className="text-fg-2" /> ms/row
          </span>
          <span className="flex items-center gap-1">
            last <RollingNumber value={stats.lastMs} className="text-fg-2" /> ms
          </span>
          <span className="flex items-center gap-1">
            cost {stats.costUsd === null ? "n/a" : <>$<RollingNumber text={usd(stats.costUsd)} className="text-fg-2" /></>}
          </span>
        </>
      ) : (
        <span>{provider === "mock" ? "offline rules, no cost" : "parse to see latency and cost"}</span>
      )}
      <span className="ml-auto flex items-center gap-1.5">
        <span className="kbd">Space</span> play
        <span className="kbd">←</span>
        <span className="kbd">→</span> shots
        <span className="kbd">C</span> subtitles
      </span>
    </footer>
  );
}
