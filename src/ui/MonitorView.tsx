import { blockAt, rowAt, useStore } from "../state/store";
import { camerasAt, strapAt, wallAt } from "../show";
import { CameraFeed } from "./CameraFeed";
import { performanceOf } from "./scene/showState";
import { timecode } from "./format";

type Props = { variant?: "compact" | "show" };

/** Program output: what the live camera sees, at its FOV, 16:9, with the burned-in label. */
export function MonitorView({ variant = "compact" }: Props) {
  const studio = useStore((s) => s.studio);
  const plan = useStore((s) => s.plan);
  const time = useStore((s) => s.time);
  const block = blockAt(plan, time);
  const row = rowAt(plan, time);
  const pgm = camerasAt(plan, studio, time).pgm;
  const camera = studio.cameras.find((c) => c.id === pgm);
  const show = variant === "show";
  const wall = wallAt(plan, time);
  const strapId = show ? strapAt(performanceOf(plan, studio), time) : null;
  const strap = studio.people.find((p) => p.id === strapId);
  const names = block
    ? block.subjectIds.length === studio.people.length && studio.people.length > 1
      ? "Everyone"
      : block.subjectIds.map((id) => studio.people.find((p) => p.id === id)?.name.split(" ")[0]).join(" & ")
    : "";

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[10px] bg-black shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
      {block && camera ? (
        <>
          <CameraFeed cameraId={camera.id} shadows={show} />
          {/* full-screen graphics replace the picture, like a GFX source on the mixer */}
          {wall.kind === "gfx" && wall.fullScreen && (
            <div key={wall.text} className="fade-up pointer-events-none absolute inset-0 z-10 grid place-items-center bg-[radial-gradient(circle_at_50%_40%,#16244a,#05070d_70%)]">
              <div className="text-center">
                <div className="label-caps !text-accent">Graphics · full screen</div>
                <div className="mt-2 font-display text-[clamp(18px,3vw,40px)] font-bold uppercase tracking-tight text-fg">{wall.text.replace(/\b(full[\s-]?screen|fs)\b/gi, "").trim()}</div>
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2">
            <span className="rounded-[4px] bg-tally px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-white">PGM</span>
            <span className="num rounded-[4px] bg-black/55 px-1.5 py-0.5 text-[11px] text-white/85">{timecode(time)}</span>
          </div>
          {strap && (
            <div key={strap.id} className="strap-in pointer-events-none absolute bottom-[22%] left-[5%] z-20">
              <div className="rounded-t-[4px] bg-accent-strong px-3 py-1 font-display text-[clamp(11px,1.5vw,17px)] font-semibold text-white">{strap.name}</div>
              <div className="rounded-b-[4px] bg-black/75 px-3 py-0.5 text-[clamp(9px,1vw,12px)] text-white/75">{strap.aliases.includes("host") ? "Host" : "Guest"} · Evening Desk</div>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 to-transparent px-4 pb-3 pt-8">
            <div className="font-mono text-[13px] font-semibold tracking-wide text-white">
              {camera.label} · {block.shot.toUpperCase()} · {names}
            </div>
            {row?.reason && <div className="mt-0.5 truncate text-[11px] text-white/65">{row.reason}</div>}
          </div>
        </>
      ) : (
        <div className="grid h-full place-items-center text-xs text-fg-3">No program yet</div>
      )}
    </div>
  );
}
