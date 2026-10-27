import { useEffect, useRef } from "react";
import { blockAt, totalDuration, useStore } from "../../state/store";
import { cameraColor } from "../scene/colors";

function usePlayback() {
  const playing = useStore((s) => s.playing);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = (now: number) => {
      const { time, plan, setTime, setPlaying } = useStore.getState();
      const dt = last.current === null ? 0 : (now - last.current) / 1000;
      last.current = now;
      const end = totalDuration(plan);
      if (time + dt >= end) {
        setTime(end);
        setPlaying(false);
        return;
      }
      setTime(time + dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      last.current = null;
    };
  }, [playing]);
}

export function Timeline() {
  usePlayback();
  const { plan, studio, time, setTime, playing, setPlaying } = useStore();
  const total = totalDuration(plan);
  const active = blockAt(plan, time);
  const trackRef = useRef<HTMLDivElement>(null);

  const seekFromPointer = (clientX: number) => {
    const el = trackRef.current;
    if (!el || !total) return;
    const r = el.getBoundingClientRect();
    setTime(Math.max(0, Math.min(total, ((clientX - r.left) / r.width) * total)));
  };

  return (
    <div className="flex items-center gap-3 border-y border-ink-700 bg-ink-900 px-4 py-2">
      <button
        onClick={() => setPlaying(!playing)}
        disabled={!total}
        aria-label={playing ? "Pause" : "Play"}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-950 hover:bg-white disabled:opacity-30"
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="1" width="3" height="10" fill="currentColor" /><rect x="7" y="1" width="3" height="10" fill="currentColor" /></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor" /></svg>
        )}
      </button>
      <div className="w-24 shrink-0 font-mono text-[11px] tabular-nums text-ink-300">
        {time.toFixed(1)} / {total.toFixed(1)} s
      </div>
      <div
        ref={trackRef}
        className="relative h-9 flex-1 cursor-pointer select-none"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).dataset.block) return;
          seekFromPointer(e.clientX);
        }}
      >
        {plan.blocks.map((b, i) => {
          const camIndex = studio.cameras.findIndex((c) => c.id === b.cameraId);
          const cam = studio.cameras[camIndex];
          const live = active === b;
          return (
            <button
              key={i}
              data-block
              title={`${cam?.label} · ${b.shot} · ${b.start.toFixed(1)}–${(b.start + b.duration).toFixed(1)} s`}
              onClick={() => setTime(b.start)}
              className={`absolute inset-y-0 overflow-hidden rounded-[3px] border-l px-1.5 text-left text-[10px] font-semibold text-white/90 ${
                live ? "ring-2 ring-tally ring-inset" : ""
              }`}
              style={{
                left: `${(b.start / total) * 100}%`,
                width: `calc(${(b.duration / total) * 100}% - 2px)`,
                background: cameraColor(camIndex),
                borderColor: "rgba(0,0,0,0.4)",
                opacity: live ? 1 : 0.72,
              }}
            >
              <div className="truncate pt-1">{cam?.label}</div>
              <div className="truncate font-normal text-white/70">{b.shot}</div>
            </button>
          );
        })}
        {total > 0 && (
          <div className="pointer-events-none absolute -inset-y-1 w-px bg-tally" style={{ left: `${(time / total) * 100}%` }}>
            <div className="absolute -left-[4px] -top-1 h-2 w-[9px] rounded-sm bg-tally" />
          </div>
        )}
      </div>
    </div>
  );
}
