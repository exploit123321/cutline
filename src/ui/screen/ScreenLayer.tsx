import type { Studio } from "../../model/types";
import { CORNER, type Corner, type ScreenState } from "../../show";
import { firstName, speakerColour } from "../speakers";
import { ScreenBody } from "./contents";
import { IsoFeed } from "./IsoFeed";

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Share of the frame the screen takes in a split layout; the studio keeps the rest, on the left. */
export const SPLIT_SCREEN = 0.56;

/**
 * The part of the frame the studio feed keeps while a screen is up, as left and width in
 * 0..1. The feed is drawn on the canvas above the screen, so it must never overlap it:
 * coming in, the screen pushes the studio off to the left; going out, it uncovers it from
 * the right. A split keeps the studio on its left part.
 */
export function screenWipe(state: ScreenState): { left: number; width: number } {
  if (state.segment.content.kind === "split") return { left: 0, width: 1 - SPLIT_SCREEN * state.enter * (1 - state.exit) };
  if (state.exit > 0) return { left: 1 - state.exit, width: state.exit };
  return { left: 0, width: 1 - state.enter };
}

/** A dark tint of a speaker's colour for the background of their square. */
function tint(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number, base: number) => Math.round(base + (c - base) * 0.16);
  const r = mix((n >> 16) & 255, 13);
  const g = mix((n >> 8) & 255, 15);
  const b = mix(n & 255, 22);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Where on the frame the people's squares sit for each corner. */
const PLACE: Record<Exclude<Corner, "none">, string> = {
  right: "bottom-[4%] right-[2.5%] flex-row items-end",
  left: "bottom-[4%] left-[2.5%] flex-row items-end",
  centre: "left-1/2 top-[20%] -translate-x-1/2 flex-col items-center",
};

/**
 * The shared screen over the program: it slides in from the right and out to the left,
 * and the people come up as cut-out squares in the corner that keeps the content clear.
 * The speaker's square is a little bigger, framed in their subtitle colour.
 */
export function ScreenLayer({ state, studio, brand }: { state: ScreenState; studio: Studio; brand: string }) {
  const c = state.segment.content;
  const split = c.kind === "split";
  // a full screen leaves to the left as the studio comes back; a split panel goes back out to the right
  const x = (1 - state.enter) * 100 + state.exit * (split ? 100 : -100);
  const corner = CORNER[c.kind];
  return (
    <>
      {/* No z-index on purpose: the screen paints under the 3D canvas, so the people's
          squares (drawn on that canvas) can sit on top of it. The studio feed is narrowed
          to the part of the frame the screen does not cover (screenWipe). */}
      <div
        className="pointer-events-none absolute bottom-0 right-0 top-0 overflow-hidden shadow-[-1cqw_0_3cqw_rgba(0,0,0,0.5)]"
        style={{ width: split ? `${SPLIT_SCREEN * 100}%` : "100%", transform: `translateX(${x}%)` }}
      >
        <ScreenBody c={c} s={state} brand={brand} />
      </div>
      {corner !== "none" && (
        <div className={`pointer-events-none absolute z-[14] flex gap-[1cqw] ${PLACE[corner]}`}>
          {studio.people.map((p, i) => {
            const talking = state.speakerId === p.id;
            const colour = speakerColour(studio, p.id);
            const pop = smooth((state.local - 0.3 - i * 0.09) / 0.35) * (1 - state.exit);
            const size = talking ? 13 : 10.5;
            return (
              <div
                key={p.id}
                className="relative overflow-hidden rounded-[0.8cqw] transition-[width,height,box-shadow] duration-300 ease-out"
                style={{
                  width: `${size}cqw`,
                  height: `${size}cqw`,
                  opacity: pop,
                  transform: `scale(${0.7 + 0.3 * pop})`,
                  boxShadow: talking ? `0 0 0 0.35cqw ${colour}, 0 1cqw 2.5cqw rgba(0,0,0,0.55)` : "0 0 0 0.2cqw rgba(255,255,255,0.75), 0 1cqw 2cqw rgba(0,0,0,0.5)",
                }}
              >
                <IsoFeed className="absolute inset-0" person={p} index={i} tint={tint(colour)} />
                <span
                  className="absolute bottom-[0.5cqw] left-[0.5cqw] rounded-[0.3cqw] bg-black/65 px-[0.6cqw] py-[0.15cqw] text-[max(1.15cqw,9px)] font-semibold"
                  style={{ color: talking ? colour : "#ececf2" }}
                >
                  {firstName(studio, p.id)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
