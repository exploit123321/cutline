import { View } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import { StudioView } from "./StudioView";

export function App() {
  const root = useRef<HTMLDivElement>(null!);
  return (
    <div ref={root} className="relative flex h-full flex-col">
      <header className="flex h-11 items-center gap-3 border-b border-ink-700 px-4">
        <span className="h-2 w-2 rounded-full bg-tally" />
        <span className="font-semibold tracking-wide">Cutline</span>
        <span className="text-xs text-ink-400">previs for live shows</span>
      </header>
      <main className="relative flex-1">
        <div className="relative h-full">
          <StudioView />
        </div>
      </main>
      <Canvas eventSource={root} className="!pointer-events-none !fixed !inset-0">
        <View.Port />
      </Canvas>
    </div>
  );
}
