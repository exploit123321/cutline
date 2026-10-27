import { camerasAt, personAt, type CamState } from "../../show";
import { blockAt, rowAt, useStore } from "../../state/store";
import type { Camera, Row } from "../../model/types";
import { CameraFeed } from "../CameraFeed";
import { MonitorView } from "../MonitorView";
import { RollingNumber } from "../motion/RollingNumber";
import { Timeline } from "../panels/Timeline";
import { performanceOf } from "../scene/showState";
import { speakerColour } from "../speakers";
import { StudioView } from "../StudioView";
import { SAMPLES } from "../../fixtures/samples";

/**
 * The show, played back: the studio in 3D, the program output, and every camera's own
 * picture, all driven by one playhead. Off-air cameras pan to their next shot before
 * the cut, people turn to whoever talks, and the video wall follows the rundown.
 */
export function ShowView() {
  const blocks = useStore((s) => s.plan.blocks.length);
  if (!blocks) return <EmptyShow />;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3 p-3">
        <section className="panel relative min-h-0 overflow-hidden rounded-[12px]">
          <StudioView shadows big />
          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-center justify-between">
            <span className="label-caps">Studio · live</span>
            <span className="text-[11px] text-fg-3">orbit · drag people and cameras</span>
          </div>
          <Legend />
        </section>
        <section className="flex min-h-0 flex-col gap-3">
          {/* the program takes the largest 16:9 that fits once the multiview and Now/Next have their room */}
          <div className="min-h-0 flex-1 [container-type:size]">
            <MonitorView variant="show" fit />
          </div>
          <Multiview />
          <NowNext />
        </section>
      </div>
      <Timeline big />
    </div>
  );
}

function Legend() {
  const item = (colour: string, label: string, dashed = false) => (
    <span className="chip !h-6 !bg-black/50 backdrop-blur">
      <span className={dashed ? "h-0 w-3 border-t-2 border-dashed" : "h-1.5 w-1.5 rounded-full"} style={dashed ? { borderColor: colour } : { background: colour }} />
      {label}
    </span>
  );
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap gap-1.5">
      {item("var(--color-tally)", "On air")}
      {item("var(--color-pvw)", "Next")}
      {item("var(--color-accent)", "Talking")}
      {item("var(--color-warn)", "180° line", true)}
    </div>
  );
}

function Multiview() {
  const studio = useStore((s) => s.studio);
  const plan = useStore((s) => s.plan);
  const time = useStore((s) => s.time);
  const cams = camerasAt(plan, studio, time);
  return (
    <div className="grid shrink-0 gap-2" style={{ gridTemplateColumns: `repeat(${studio.cameras.length}, minmax(0, 1fr))` }}>
      {studio.cameras.map((c) => {
        const s = cams.states[c.id];
        return s ? <CameraTile key={c.id} camera={c} state={s} cutKey={s.status === "pgm" ? (cams.block?.start ?? 0) : -1} /> : null;
      })}
    </div>
  );
}

const TILE = {
  pgm: { ring: "inset 0 0 0 2px var(--color-tally)", tag: "PGM", tagCls: "bg-tally text-white" },
  pvw: { ring: "inset 0 0 0 2px var(--color-pvw)", tag: "PVW", tagCls: "bg-pvw text-black" },
  idle: { ring: "inset 0 0 0 1px var(--color-line-strong)", tag: "", tagCls: "" },
} as const;

function CameraTile({ camera, state, cutKey }: { camera: Camera; state: CamState; cutKey: number }) {
  const look = TILE[state.status];
  return (
    <div className="min-w-0">
      <div className="relative aspect-video overflow-hidden rounded-[8px] bg-black" style={{ boxShadow: look.ring }}>
        <CameraFeed cameraId={camera.id} />
        {/* the flash restarts on each cut by remounting this overlay only, never the 3D view */}
        {state.status === "pgm" && <span key={cutKey} className="cut-flash pointer-events-none absolute inset-0 z-[6] rounded-[8px]" />}
        <div className="pointer-events-none absolute inset-x-1.5 top-1.5 z-10 flex items-center justify-between">
          <span className="rounded-[4px] bg-black/60 px-1.5 py-px font-mono text-[10px] font-semibold text-white">{camera.label}</span>
          {look.tag && <span className={`rounded-[4px] px-1.5 py-px text-[9.5px] font-bold tracking-widest ${look.tagCls}`}>{look.tag}</span>}
        </div>
        {/* sits above the 3D view and lets the pointer through: the View's own div keeps receiving orbit events */}
        <div className="pointer-events-none absolute inset-0 z-[5] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]" />
      </div>
      <div className="mt-1 flex items-center justify-between px-0.5 text-[10.5px] text-fg-3">
        <span className="num">
          {Math.round(state.fov)}° · {camera.fixed ? "locked off" : "operated"}
        </span>
        {state.moving ? (
          <span className="flex items-center gap-1 text-pvw">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-pvw" />
            moving
          </span>
        ) : state.onAir !== null ? (
          <span className="num text-tally">{state.onAir.toFixed(1)} s on air</span>
        ) : (
          <span>ready</span>
        )}
      </div>
    </div>
  );
}

const TYPE_TONE: Record<string, string> = {
  dialogue: "text-accent",
  action: "text-fg",
  visual: "text-warn",
  cut: "text-tally",
  cue: "text-pvw",
  note: "text-fg-3",
};

/** One rundown row on one line: a NOW/NEXT tag, the number, the type, then speaker and text. */
function RowLine({ tag, row, big, speaker, colour }: { tag: string; row: Row; big?: boolean; speaker?: string; colour?: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2.5">
      <span className="label-caps w-9 shrink-0">{tag}</span>
      <span className="num w-5 shrink-0 text-right text-[12.5px] text-fg-3">{row.index + 1}</span>
      <span className={`w-[4.5rem] shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.06em] ${TYPE_TONE[row.type ?? ""] ?? "text-fg-3"}`}>{row.type ?? "—"}</span>
      <span className={`min-w-0 truncate ${big ? "text-[17px] text-fg" : "text-[14px] text-fg-2"}`}>
        {speaker && (
          <span className="font-semibold" style={{ color: colour }}>
            {speaker}{" "}
          </span>
        )}
        {row.text}
      </span>
    </div>
  );
}

/** Only as tall as its content: status, the action on air, the next action. The program takes the rest. */
function NowNext() {
  const studio = useStore((s) => s.studio);
  const plan = useStore((s) => s.plan);
  const time = useStore((s) => s.time);
  const row = rowAt(plan, time);
  const block = blockAt(plan, time);
  const idx = row ? plan.rows.indexOf(row) : -1;
  const next = plan.rows.slice(idx + 1).find((r) => (r.duration ?? 0) > 0);
  const cams = camerasAt(plan, studio, time);
  const shotNo = block ? plan.blocks.indexOf(block) + 1 : 0;
  const cutIn = cams.next ? Math.max(0, cams.next.start - time) : null;
  const perf = performanceOf(plan, studio);
  const name = (id: string | null) => studio.people.find((p) => p.id === id)?.name.split(" ")[0];
  const talking = studio.people.find((p) => personAt(perf, p, time).talking);
  const nextCam = studio.cameras.find((c) => c.id === cams.pvw);

  return (
    <div className="panel flex shrink-0 flex-col gap-2 rounded-[12px] px-4 py-3">
      <div className="flex items-center gap-2.5 text-[13px]">
        <span className="chip !h-7 !text-[13px]">
          shot <RollingNumber value={shotNo} className="font-semibold text-fg" /> / {plan.blocks.length}
        </span>
        {talking && (
          <span className="chip !h-7 !text-[13px]">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" />
            {name(talking.id)} talking
          </span>
        )}
        {cutIn !== null && nextCam && (
          <span className="ml-auto flex items-center gap-1.5 text-[13.5px] text-fg-2">
            cut to <span className="font-semibold text-pvw">{nextCam.label}</span> in
            <span className="num font-semibold text-fg">{cutIn.toFixed(1)}</span>s
          </span>
        )}
      </div>
      {row && (
        <div key={row.id} className="fade-up">
          <RowLine tag="Now" row={row} big speaker={name(row.speakerId)} colour={speakerColour(studio, row.speakerId)} />
        </div>
      )}
      {next && (
        <div className="border-t border-line pt-2">
          <RowLine tag="Next" row={next} speaker={name(next.speakerId)} colour={speakerColour(studio, next.speakerId)} />
        </div>
      )}
    </div>
  );
}

function EmptyShow() {
  const loadSample = useStore((s) => s.loadSample);
  const parse = useStore((s) => s.parse);
  const parsing = useStore((s) => s.parsing);
  const setMode = useStore((s) => s.setMode);
  return (
    <div className="grid flex-1 place-items-center p-6">
      <div className="panel fade-up w-[420px] rounded-[14px] p-6 text-center">
        <div className="label-caps">Show</div>
        <h2 className="mt-2 font-display text-[20px] font-semibold text-fg">Nothing to play yet</h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-fg-2">
          The show plays the cut plan of a parsed rundown: the studio in 3D, the program output and every camera at once.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {SAMPLES.map((s, i) => (
            <button
              key={s.id}
              className={`btn ${i === 0 ? "btn-primary" : ""} !h-auto !justify-start !py-2 text-left`}
              disabled={parsing !== null}
              onClick={async () => {
                loadSample(s.id);
                await parse();
              }}
            >
              <span className="flex flex-col">
                <span className="font-semibold">{parsing ? `Classifying ${parsing.done}/${parsing.total}…` : `Play ${s.label}`}</span>
                <span className="text-[11.5px] font-normal opacity-75">{s.hint}</span>
              </span>
            </button>
          ))}
          <button className="btn mt-1" onClick={() => setMode("plan")}>
            Open the planner
          </button>
        </div>
      </div>
    </div>
  );
}
