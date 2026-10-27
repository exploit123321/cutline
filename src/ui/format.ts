/** Broadcast timecode at 25 fps: HH:MM:SS:FF. */
export function timecode(seconds: number, fps = 25): string {
  const total = Math.max(0, Math.floor(seconds * fps + 1e-6));
  const ff = total % fps;
  const s = Math.floor(total / fps);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(ff)}`;
}
