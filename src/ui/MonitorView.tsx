import type { Person } from "../model/types";
import { camerasAt, CORNER, screenAt, strapAt, subtitleAt, type Strap } from "../show";
import { blockAt, useStore } from "../state/store";
import { CameraFeed } from "./CameraFeed";
import { timecode } from "./format";
import { ScreenLayer, screenWipe } from "./screen/ScreenLayer";
import { performanceOf, screensOf } from "./scene/showState";
import { brandOf, firstName, initials, speakerColour } from "./speakers";

type Props = {
  variant?: "compact" | "show";
  /** fit inside a parent that is a size container ([container-type:size]): the largest 16:9 */
  fit?: boolean;
};

/**
 * Program output: what goes to air, 16:9. The live camera, or the shared screen with the
 * people as cut-out squares; the lower-third, subtitles and the show bug on top.
 */
export function MonitorView({ variant = "compact", fit = false }: Props) {
  const studio = useStore((s) => s.studio);
  const plan = useStore((s) => s.plan);
  const time = useStore((s) => s.time);
  const subtitlesOn = useStore((s) => s.subtitles);
  const block = blockAt(plan, time);
  const pgm = camerasAt(plan, studio, time).pgm;
  const camera = studio.cameras.find((c) => c.id === pgm);
  const show = variant === "show";
  const brand = brandOf(studio);
  const strap = strapAt(performanceOf(plan, studio), time);
  const strapPerson = strap ? studio.people.find((p) => p.id === strap.personId) : undefined;
  const sub = subtitlesOn ? subtitleAt(plan, time) : null;

  const screen = screenAt(screensOf(plan), time);
  const onScreen = screen && !screen.reaction ? screen : null;
  const wipe = onScreen ? screenWipe(onScreen) : { left: 0, width: 1 };
  // a full screen covers the studio completely once it is in: stop drawing the camera then
  const covered = wipe.width <= 0;
  const corner = onScreen ? CORNER[onScreen.segment.content.kind] : "none";

  return (
    <div className={fit ? "mx-auto" : ""} style={fit ? { width: "min(100cqw, calc(100cqh * 16 / 9))" } : undefined}>
      <div className="@container relative aspect-video w-full overflow-hidden rounded-[10px] bg-black shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
        {block && camera ? (
          <>
            {!covered && (
              // the studio keeps the part of the frame the screen leaves; the view keeps its height
              <CameraFeed
                cameraId={camera.id}
                shadows={show}
                className="absolute bottom-0 top-0"
                style={{ left: `${wipe.left * 100}%`, width: `${wipe.width * 100}%` }}
              />
            )}
            {onScreen && <ScreenLayer state={onScreen} studio={studio} brand={brand} />}
            <div className="pointer-events-none absolute left-[2.5%] top-[4%] z-20 flex items-center gap-2">
              <span className="rounded-[4px] bg-tally px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-white">PGM</span>
              <span className="num rounded-[4px] bg-black/55 px-1.5 py-0.5 text-[11px] text-white/85">{timecode(time)}</span>
            </div>
            <ShowBug brand={brand} />
            {strap && strapPerson && <LowerThird person={strapPerson} strap={strap} brand={brand} />}
            {sub && (
              <SubtitleLine
                key={sub.key}
                speaker={firstName(studio, sub.speakerId)}
                colour={speakerColour(studio, sub.speakerId)}
                text={sub.text}
                // keep clear of the strap at the left, or of the people's squares
                area={strap ? "right-of-strap" : corner === "right" ? "left" : corner === "left" ? "right" : "centre"}
              />
            )}
          </>
        ) : (
          <div className="grid h-full place-items-center text-xs text-fg-3">No program yet</div>
        )}
      </div>
    </div>
  );
}

/** The channel bug: the show's initials, top right, 85% opaque. */
function ShowBug({ brand }: { brand: string }) {
  return (
    <div className="pointer-events-none absolute right-[2.5%] top-[4%] z-20 flex items-center gap-[0.6cqw] font-strap opacity-85">
      <span className="rounded-[0.3cqw] bg-gradient-to-b from-[#7f9dff] to-[#3d5bd1] px-[0.7cqw] py-[0.15cqw] text-[max(1.6cqw,10px)] font-extrabold leading-tight text-white">
        {initials(brand)}
      </span>
      <span className="text-[max(1.3cqw,9px)] font-bold uppercase tracking-[0.14em] text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]">{brand}</span>
    </div>
  );
}

/** 70% of the first size: dimensions in cqw, with a floor so the smallest text stays readable. */
const K = 0.7;
const cq = (n: number, floorPx = 0) => (floorPx ? `max(${n * K}cqw, ${floorPx}px)` : `${n * K}cqw`);

/**
 * News lower-third, in two tiers: the show block and the name on top, the role on a
 * shorter bar under them from the left edge, both with an angled end. Big Shoulders
 * Display, bars 85% opaque. Low at the left, level with the subtitles, which move to its
 * right while it is up. It wipes on from the left, and goes out with a cut or wipes off as
 * the next phrase starts (`strapAt`).
 */
function LowerThird({ person, strap, brand }: { person: Person; strap: Strap; brand: string }) {
  const role = person.role ?? (person.aliases.some((a) => a.toLowerCase() === "host") ? "Host" : "Guest");
  const open = strap.enter * (1 - strap.exit);
  const text = Math.max(0, Math.min(1, (strap.enter - 0.35) / 0.65)) * (1 - strap.exit);
  const slant = `polygon(0 0, 100% 0, calc(100% - ${cq(1.4)}) 100%, 0 100%)`;
  return (
    <div
      className="pointer-events-none absolute bottom-[5.5%] left-[2.5%] z-20 flex flex-col items-start font-strap"
      style={{ clipPath: `inset(0 ${(1 - open) * 100}% 0 0)` }}
    >
      <div className="flex items-stretch" style={{ height: cq(6.2) }}>
        <div
          className="flex flex-col items-center justify-center bg-gradient-to-b from-[rgba(127,157,255,0.85)] to-[rgba(61,91,209,0.85)] text-white"
          style={{ width: cq(6.6) }}
        >
          <span className="font-extrabold leading-none tracking-[0.02em]" style={{ fontSize: cq(3.3) }}>
            {initials(brand)}
          </span>
          <span className="mt-[0.2cqw] flex items-center gap-[0.25cqw] font-bold uppercase leading-none tracking-[0.2em]" style={{ fontSize: cq(1, 6) }}>
            <span className="rounded-full bg-tally" style={{ width: cq(0.6), height: cq(0.6) }} />
            Live
          </span>
        </div>
        <div className="flex items-center bg-[rgba(244,245,250,0.85)]" style={{ minWidth: cq(30), paddingLeft: cq(1.5), paddingRight: cq(3.2), clipPath: slant }}>
          <span
            className="font-extrabold uppercase leading-none tracking-[0.015em] text-[#0b1020]"
            style={{ fontSize: cq(4.1), opacity: text, transform: `translateY(${(1 - text) * 35}%)` }}
          >
            {person.name}
          </span>
        </div>
      </div>
      <div className="flex items-center bg-[rgba(18,26,51,0.85)]" style={{ height: cq(3.1), paddingLeft: cq(1.5), paddingRight: cq(3), clipPath: slant }}>
        <span className="font-bold uppercase leading-none tracking-[0.16em] text-white" style={{ fontSize: cq(1.9, 8), opacity: text }}>
          {role} · {brand}
        </span>
      </div>
    </div>
  );
}

const AREA = {
  centre: { left: "8%", right: "8%" },
  "right-of-strap": { left: "30%", right: "4%" },
  // the squares take the other side
  left: { left: "3%", right: "44%" },
  right: { left: "44%", right: "3%" },
} as const;

/**
 * Burned-in subtitle: "Name: text", the name in the speaker's colour. No box: an outline
 * and a soft shadow keep it readable. Always low; it moves sideways only to stay clear of
 * the strap or the people's squares, and those change only on a cut or a new phrase.
 */
function SubtitleLine({ speaker, colour, text, area }: { speaker: string | null; colour: string; text: string; area: keyof typeof AREA }) {
  return (
    <div className="sub-in pointer-events-none absolute bottom-[6%] z-30 flex justify-center" style={AREA[area]}>
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
