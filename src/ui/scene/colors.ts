/** Timeline colours per camera. Deliberately muted: red is reserved for the live (tally) camera. */
const PALETTE = ["#4f8cc9", "#3fa796", "#9a7fd1", "#c9954f", "#c96f9e", "#6fb0c9"];

export function cameraColor(index: number): string {
  return PALETTE[index % PALETTE.length] as string;
}
