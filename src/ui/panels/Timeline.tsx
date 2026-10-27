import { useRef, type ReactNode } from "react";
import { blockAt, totalDuration, useStore } from "../../state/store";
import { timecode } from "../format";
import { RollingNumber } from "../motion/RollingNumber";
import { SegmentedControl } from "../motion/SegmentedControl";
import { cameraColor } from "../scene/colors";

const SPEEDS = [
  { id: "0.5", label: "0.5×" },
  { id: "1", label: "1×" },
  { id: "2", label: "2×" },
];

const Icon = {
  play: <path d="M4 2.5v11l9-5.5z" fill="currentColor" />,
  pause: (
    <>
      <rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
      <rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
    </>
  ),
  prev: <path d="M3 3v10M13 3 6 8l7 5z" stroke="currentColor" strokeWidth="1.6" fill="currentColor" strokeLinejoin="round" />,
  next: <path d="M13 3v10M3 3l7 5-7 5z" stroke="currentColor" strokeWidth="1.6" fill="currentColor" strokeLinejoin="round" />,
};
const svg = (d: ReactNode) => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
    {d}
  </svg>
);

/** Transport and shot blocks. The playhead is the one clock everything else reads. */
export function Timeline({ big = false }: { big?: boolean }) {
  const { plan, studio, time, setTime, playing, setPlaying, stepShot, speed, setSpeed } = useStore();
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
    <div className={`flex items-center gap-3 border-y border-line bg-elev px-4 ${big ? "py-3" : "py-2"}`}>
      <div className="flex shrink-0 items-center gap-1">
        <button className="icon-btn" onClick={() => stepShot(-1)} disabled={!total} title="Previous shot (←)">
          {svg(Icon.prev)}
        </button>
        <button
          onClick={() => setPlaying(!playing)}
          disabled={!total}
          aria-label={playing ? "Pause" : "Play"}
          title="Play / pause (Space)"
          className="btn btn-primary !h-9 !w-9 !rounded-full !p-0"
        >
          {svg(playing ? Icon.pause : Icon.play)}
        </button>
        <button className="icon-btn" onClick={() => stepShot(1)} disabled={!total} title="Next shot (→)">
          {svg(Icon.next)}
        </button>
      </div>
      <div className="w-[150px] shrink-0">
        <RollingNumber text={timecode(time)} className="text-[13px] font-semibold text-fg" />
        <div className="num text-[10.5px] text-fg-3">of {timecode(total)}</div>
      </div>
      <div
        ref={trackRef}
        className={`relative flex-1 cursor-pointer select-none ${big ? "h-11" : "h-9"}`}
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
              className="absolute inset-y-0 overflow-hidden rounded-[6px] px-1.5 text-left text-[10px] font-semibold text-white/90 transition-[opacity,box-shadow] duration-200"
              style={{
                left: `${(b.start / total) * 100}%`,
                width: `calc(${(b.duration / total) * 100}% - 2px)`,
                background: `linear-gradient(180deg, ${cameraColor(camIndex)}, ${cameraColor(camIndex)}cc)`,
                opacity: live ? 1 : 0.62,
                boxShadow: live ? "inset 0 0 0 2px var(--color-tally), 0 0 14px -2px rgba(255,69,58,0.55)" : "inset 0 0 0 1px rgba(0,0,0,0.35)",
              }}
            >
              <div data-block className="truncate pt-1">{cam?.label}</div>
              <div data-block className="truncate font-normal text-white/70">{b.shot}</div>
            </button>
          );
        })}
        {total > 0 && (
          <div className="pointer-events-none absolute -inset-y-1 w-[2px] -translate-x-1/2 rounded-full bg-tally shadow-[0_0_8px_rgba(255,69,58,0.8)]" style={{ left: `${(time / total) * 100}%` }}>
            <div className="absolute -left-[4px] -top-1 h-2.5 w-2.5 rounded-full bg-tally" />
          </div>
        )}
      </div>
      <SegmentedControl size="sm" options={SPEEDS} value={String(speed)} onChange={(v) => setSpeed(Number(v))} />
    </div>
  );
}
