import { useEffect } from "react";
import { totalDuration, useStore } from "../state/store";

/** Advances the playhead while playing. Mounted once, in App, so both modes share one clock. */
export function usePlayback() {
  const playing = useStore((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      const { time, plan, speed, setTime, setPlaying } = useStore.getState();
      const dt = last === null ? 0 : ((now - last) / 1000) * speed;
      last = now;
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
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}

/** Space plays and pauses, arrows step between shots. Ignored while typing in a field. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      if (el instanceof Element && el.closest("input, textarea, select, button, [contenteditable]")) return;
      const s = useStore.getState();
      if (e.code === "Space") {
        e.preventDefault();
        if (s.plan.blocks.length) s.setPlaying(!s.playing);
      } else if (e.key === "ArrowRight") {
        s.stepShot(1);
      } else if (e.key === "ArrowLeft") {
        s.stepShot(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
