import type { Person } from "../model/types";
import { camerasAt, strapAt, subtitleAt, wallAt, type Strap } from "../show";
import { blockAt, rowAt, useStore } from "../state/store";
import { CameraFeed } from "./CameraFeed";
import { timecode } from "./format";
import { performanceOf } from "./scene/showState";
import { firstName, speakerColour } from "./speakers";

type Props = {
  variant?: "compact" | "show";
  /**
   * Fit inside a parent that is a size container ([container-type:size]): the picture
   * takes the largest 16:9 that leaves room for the label strip under it.
   */
  fit?: boolean;
};

/** Height of the label strip under the picture, in px. */
const STRIP = 30;

/**
 * Program output: what the live camera sees, at its FOV, 16:9. The picture carries only
 * what goes to air (graphics, lower-third, subtitles, the PGM tally); the camera, shot
 * and reason sit in a strip under it.
 */
export function MonitorView({ variant = "compact", fit = false }: Props) {
  const studio = useStore((s) => s.studio);
  const plan = useStore((s) => s.plan);
  const time = useStore((s) => s.time);
  const subtitlesOn = useStore((s) => s.subtitles);
  const block = blockAt(plan, time);
  const row = rowAt(plan, time);
  const pgm = camerasAt(plan, studio, time).pgm;
  const camera = studio.cameras.find((c) => c.id === pgm);
  const show = variant === "show";
  const wall = wallAt(plan, time);
  const strap = strapAt(performanceOf(plan, studio), time);
  const strapPerson = strap ? studio.people.find((p) => p.id === strap.personId) : undefined;
  const sub = subtitlesOn ? subtitleAt(plan, time) : null;
  const names = block
    ? block.subjectIds.length === studio.people.length && studio.people.length > 1
      ? "Everyone"
      : block.subjectIds.map((id) => firstName(studio, id)).join(" & ")
    : "";

  return (
    <div className={fit ? "mx-auto" : ""} style={fit ? { width: `min(100cqw, calc((100cqh - ${STRIP}px) * 16 / 9))` } : undefined}>
      <div className="@container relative aspect-video w-full overflow-hidden rounded-[10px] bg-black shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
        {block && camera ? (
          <>
            <CameraFeed cameraId={camera.id} shadows={show} />
            {/* full-screen graphics replace the picture, like a GFX source on the mixer */}
            {wall.kind === "gfx" && wall.fullScreen && (
              <div key={wall.text} className="fade-up pointer-events-none absolute inset-0 z-10 grid place-items-center bg-[radial-gradient(circle_at_50%_40%,#16244a,#05070d_70%)]">
                <div className="text-center">
                  <div className="label-caps !text-accent">Graphics · full screen</div>
                  <div className="mt-2 font-display text-[clamp(18px,3vw,40px)] font-bold uppercase tracking-tight text-fg">
                    {wall.text.replace(/\b(full[\s-]?screen|fs)\b/gi, "").trim()}
                  </div>
                </div>
              </div>
            )}
            <div className="pointer-events-none absolute left-[2.5%] top-[4%] z-20 flex items-center gap-2">
              <span className="rounded-[4px] bg-tally px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-white">PGM</span>
              <span className="num rounded-[4px] bg-black/55 px-1.5 py-0.5 text-[11px] text-white/85">{timecode(time)}</span>
            </div>
            {strap && strapPerson && <LowerThird person={strapPerson} strap={strap} />}
            {sub && (
              <SubtitleLine
                key={sub.key}
                speaker={firstName(studio, sub.speakerId)}
                colour={speakerColour(studio, sub.speakerId)}
                text={sub.text}
              />
            )}
          </>
        ) : (
          <div className="grid h-full place-items-center text-xs text-fg-3">No program yet</div>
        )}
      </div>
      <div className="flex items-center gap-2 overflow-hidden px-1 text-[12.5px]" style={{ height: STRIP }}>
        {block && camera ? (
          <>
            <span className="shrink-0 font-semibold tracking-wide text-fg">
              {camera.label} · {block.shot.toUpperCase()} · {names}
            </span>
            {row?.reason && <span className="truncate text-fg-3">{row.reason}</span>}
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * News lower-third, in two tiers: the show block and the name on top, the role on a
 * shorter bar under them from the left edge, both with an angled end. Set in Big Shoulders
 * Display; the bars are 85% opaque so the picture shows through a little. It sits at the
 * left above the subtitle area, so subtitles never move. It wipes on from the left, and
 * goes out with a cut or wipes off as the next phrase starts (`strapAt`).
 */
function LowerThird({ person, strap }: { person: Person; strap: Strap }) {
  const role = person.aliases.some((a) => a.toLowerCase() === "host") ? "Host" : "Guest";
  // on: the bars open left to right; off: they close right to left
  const open = strap.enter * (1 - strap.exit);
  const text = Math.max(0, Math.min(1, (strap.enter - 0.35) / 0.65)) * (1 - strap.exit);
  const slant = "polygon(0 0, 100% 0, calc(100% - 1.4cqw) 100%, 0 100%)";
  return (
    <div
      className="pointer-events-none absolute bottom-[24%] left-[3.5%] z-20 flex flex-col items-start font-strap"
      style={{ clipPath: `inset(0 ${(1 - open) * 100}% 0 0)` }}
    >
      <div className="flex h-[6.2cqw] items-stretch">
        <div className="flex w-[6.6cqw] flex-col items-center justify-center bg-gradient-to-b from-[rgba(127,157,255,0.85)] to-[rgba(61,91,209,0.85)] text-white">
          <span className="text-[3.3cqw] font-extrabold leading-none tracking-[0.02em]">ED</span>
          <span className="mt-[0.25cqw] flex items-center gap-[0.35cqw] text-[1cqw] font-bold uppercase leading-none tracking-[0.2em]">
            <span className="h-[0.6cqw] w-[0.6cqw] rounded-full bg-tally" />
            Live
          </span>
        </div>
        <div className="flex min-w-[30cqw] items-center bg-[rgba(244,245,250,0.85)] pl-[1.5cqw] pr-[3.2cqw]" style={{ clipPath: slant }}>
          <span
            className="text-[4.1cqw] font-extrabold uppercase leading-none tracking-[0.015em] text-[#0b1020]"
            style={{ opacity: text, transform: `translateY(${(1 - text) * 35}%)` }}
          >
            {person.name}
          </span>
        </div>
      </div>
      <div className="flex h-[3.1cqw] items-center bg-[rgba(18,26,51,0.85)] pl-[1.5cqw] pr-[3cqw]" style={{ clipPath: slant }}>
        <span className="text-[1.9cqw] font-bold uppercase leading-none tracking-[0.16em] text-white" style={{ opacity: text }}>
          {role} · Evening Desk
        </span>
      </div>
    </div>
  );
}

/**
 * Burned-in subtitle: "Name: text", the name in the speaker's colour. No box: an outline
 * and a soft shadow keep it readable on light picture. Always low and centred; the
 * lower-third sits above it.
 */
function SubtitleLine({ speaker, colour, text }: { speaker: string | null; colour: string; text: string }) {
  return (
    <div className="sub-in pointer-events-none absolute inset-x-[8%] bottom-[6%] z-30 flex justify-center">
      <p
        className="max-w-[44ch] text-center font-semibold leading-[1.25] text-white"
        style={{
          fontSize: "clamp(12px, 3.3cqw, 28px)",
          WebkitTextStroke: "0.12em rgba(0,0,0,0.9)",
          paintOrder: "stroke fill",
          textShadow: "0 0.06em 0.3em rgba(0,0,0,0.75)",
        }}
      >
        {speaker && <span style={{ color: colour }}>{speaker}: </span>}
        {text}
      </p>
    </div>
  );
}
