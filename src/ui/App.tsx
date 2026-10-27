import { View } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import { MonitorView } from "./MonitorView";
import { StudioView } from "./StudioView";
import { ScriptPanel } from "./panels/ScriptPanel";
import { SheetPanel } from "./panels/SheetPanel";
import { Timeline } from "./panels/Timeline";
import { useStore } from "../state/store";

export function App() {
  const root = useRef<HTMLDivElement>(null!);
  const studioName = useStore((s) => s.studio.name);
  return (
    <div ref={root} className="relative flex h-full min-w-[1280px] flex-col">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-ink-700 bg-ink-950 px-4">
        <span className="h-2 w-2 rounded-full bg-tally shadow-[0_0_8px_#ff3b30]" />
        <span className="font-semibold tracking-wide">Cutline</span>
        <span className="text-xs text-ink-500">previs for live shows</span>
        <span className="ml-auto text-xs text-ink-400">{studioName}</span>
        <span className="text-[11px] text-ink-500">AI reads text · code does geometry</span>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr]">
        <ScriptPanel />
        <div className="flex min-h-0 flex-col">
          <div className="grid shrink-0 grid-cols-[1fr_minmax(0,1.15fr)] gap-3 bg-ink-950 p-3">
            <div className="relative overflow-hidden rounded-sm ring-1 ring-ink-700">
              <div className="panel-title absolute left-3 top-2 z-10">Studio · drag to move</div>
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
      <Canvas eventSource={root} className="!pointer-events-none !fixed !inset-0" dpr={[1, 2]}>
        <View.Port />
      </Canvas>
    </div>
  );
}
