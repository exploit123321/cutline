import { View } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import { ACESFilmicToneMapping } from "three";
import { useStore, type Mode } from "../state/store";
import { Footer } from "./Footer";
import { MonitorView } from "./MonitorView";
import { SegmentedControl } from "./motion/SegmentedControl";
import { ScriptPanel } from "./panels/ScriptPanel";
import { SheetPanel } from "./panels/SheetPanel";
import { Timeline } from "./panels/Timeline";
import { ShowView } from "./show/ShowView";
import { StudioView } from "./StudioView";
import { usePlayback, useShortcuts } from "./usePlayback";

const MODES = [
  { id: "plan" as Mode, label: "Plan", hint: "Rundown, shot list and preview" },
  { id: "show" as Mode, label: "Show", hint: "Play the show: studio, program and every camera" },
];

function TitleBar() {
  const studioName = useStore((s) => s.studio.name);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const playing = useStore((s) => s.playing);
  const blocks = useStore((s) => s.plan.blocks.length);
  return (
    <header className="relative z-30 grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-bg px-4">
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-6 w-6 place-items-center rounded-[7px]"
          style={{ background: "linear-gradient(160deg, #20222c, #14151b)", boxShadow: "inset 0 0 0 1px var(--color-line-strong)" }}
        >
          {/* a frame with a cut through it */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.4" strokeLinecap="round">
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="M14 5 10 19" />
          </svg>
        </span>
        <span className="font-display text-[13.5px] font-semibold tracking-[-0.01em] text-fg">Cutline</span>
        <span className="text-[11.5px] text-fg-3">previs for live shows</span>
      </div>
      <SegmentedControl options={MODES} value={mode} onChange={setMode} />
      <div className="flex items-center justify-end gap-2">
        <span className="chip">
          <span className={`h-1.5 w-1.5 rounded-full ${playing ? "live-dot bg-tally" : blocks ? "bg-ok" : "bg-fg-3"}`} />
          {playing ? "On air" : blocks ? `${blocks} shots planned` : "No plan"}
        </span>
        <span className="hidden text-[11.5px] text-fg-3 xl:inline">{studioName}</span>
      </div>
    </header>
  );
}

function PlanView() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr]">
      <ScriptPanel />
      <div className="flex min-h-0 flex-col">
        <div className="grid shrink-0 grid-cols-[1fr_minmax(0,1.15fr)] gap-3 bg-bg p-3">
          <div className="panel relative overflow-hidden rounded-[10px]">
            <div className="label-caps pointer-events-none absolute left-3 top-2 z-10">Studio · drag to move</div>
            <StudioView />
          </div>
          <div className="flex flex-col">
            <MonitorView />
          </div>
        </div>
        <Timeline />
        <div className="min-h-0 flex-1">
          <SheetPanel />
        </div>
      </div>
    </div>
  );
}

export function App() {
  const root = useRef<HTMLDivElement>(null!);
  const mode = useStore((s) => s.mode);
  usePlayback();
  useShortcuts();
  return (
    <div ref={root} className="relative flex h-full min-w-[1280px] flex-col bg-bg">
      <TitleBar />
      {mode === "plan" ? <PlanView /> : <ShowView />}
      <Footer />
      <Canvas
        eventSource={root}
        className="!pointer-events-none !fixed !inset-0"
        dpr={[1, 2]}
        shadows="percentage"
        gl={{ toneMapping: ACESFilmicToneMapping, antialias: true }}
      >
        <View.Port />
      </Canvas>
    </div>
  );
}
