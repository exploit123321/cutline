import { useSyncExternalStore } from "react";

/** The one UI font, also used for text drawn into canvases (3D labels, the video wall). */
export const FONT = '"Afacad Variable", "Segoe UI", system-ui, sans-serif';
export const FALLBACK_FONT = '"Segoe UI", system-ui, sans-serif';

/*
 * Canvas text is drawn once into a texture, so it must wait for the web font, or it
 * stays in the fallback font. Latvian sample text pulls in the latin-ext subset too.
 */
let ready = false;
const listeners = new Set<() => void>();

if (typeof document !== "undefined" && document.fonts) {
  void Promise.all(
    ["500", "600", "700"].map((w) => document.fonts.load(`${w} 16px "Afacad Variable"`, "Mārtiņš Bērziņa 0123")),
  ).then(() => {
    ready = true;
    for (const l of listeners) l();
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The font to draw canvas text with now: Afacad once it has loaded, so the texture redraws then. */
export function useCanvasFont(): string {
  return useSyncExternalStore(subscribe, () => (ready ? FONT : FALLBACK_FONT), () => FALLBACK_FONT);
}
