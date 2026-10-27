import type { Preset } from "../format";
import { armchair, backdrop, coffeeTable, desk, rug, sofa, tvScreen } from "./set";
import { pedestalCamera, seatedFigure, standingFigure } from "./broadcast";

export const PRESETS: Record<string, Preset> = Object.fromEntries(
  [desk, coffeeTable, armchair, sofa, tvScreen, rug, backdrop, pedestalCamera, seatedFigure, standingFigure].map(
    (p) => [p.id, p],
  ),
);

export { pedestalCamera, seatedFigure, standingFigure };
