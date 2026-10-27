import { box, cyl, part, type Preset } from "../format";

/*
 * Talk-show set dressing.
 *
 * Source: written for Cutline in the preset format of exploit123321/layout-editor
 * (PRESETS in interactive_3d_map.html, brief in MODELING_PROMPT.md). The original
 * builders were not reachable from the build environment, so these are fresh
 * builders that follow the same contract and units (1 unit = 5 cm). Swap in the
 * ported originals here; the adapter and tests do not need to change.
 */

const WOOD = "#5b4636";
const WOOD_DARK = "#3d2f25";
const FABRIC = "#2d3a4a";
const FABRIC_LIGHT = "#3b4b5e";
const METAL = "#8a8f98";
const SCREEN = "#0d1b2a";
const RUG = "#1f2630";

export const desk: Preset = {
  id: "desk",
  label: "Presenter desk",
  source: "cutline (layout-editor preset format)",
  // 1.8 m wide, 0.75 m tall, 0.8 m deep
  build: () => [
    box(0, 14, 0, 36, 1, 16, WOOD),
    box(0, 0, -6, 34, 14, 2, WOOD_DARK), // front panel on the model's front (-z); turn the desk to face cameras
    box(-16, 0, 0, 2, 14, 14, WOOD_DARK),
    box(16, 0, 0, 2, 14, 14, WOOD_DARK),
  ],
};

export const coffeeTable: Preset = {
  id: "coffeeTable",
  label: "Coffee table",
  source: "cutline (layout-editor preset format)",
  build: () => [
    box(0, 8, 0, 22, 1, 12, WOOD),
    box(-9, 0, -4, 1.5, 8, 1.5, METAL),
    box(9, 0, -4, 1.5, 8, 1.5, METAL),
    box(-9, 0, 4, 1.5, 8, 1.5, METAL),
    box(9, 0, 4, 1.5, 8, 1.5, METAL),
  ],
};

export const armchair: Preset = {
  id: "armchair",
  label: "Armchair",
  source: "cutline (layout-editor preset format)",
  build: () => [
    box(0, 2, 0, 16, 7, 16, FABRIC),
    box(0, 9, 7, 16, 10, 3, FABRIC_LIGHT), // backrest behind the sitter: the model faces -z
    box(-7.5, 9, 0, 2, 4, 15, FABRIC_LIGHT),
    box(7.5, 9, 0, 2, 4, 15, FABRIC_LIGHT),
    cyl(-6, 0, -6, 1.5, 2, METAL),
    cyl(6, 0, -6, 1.5, 2, METAL),
    cyl(-6, 0, 6, 1.5, 2, METAL),
    cyl(6, 0, 6, 1.5, 2, METAL),
  ],
};

export const sofa: Preset = {
  id: "sofa",
  label: "Two-seat sofa",
  source: "cutline (layout-editor preset format)",
  build: () => [
    box(0, 2, 0, 32, 7, 16, FABRIC),
    box(0, 9, 7, 32, 10, 3, FABRIC_LIGHT),
    box(-15, 9, 0, 2, 5, 15, FABRIC_LIGHT),
    box(15, 9, 0, 2, 5, 15, FABRIC_LIGHT),
  ],
};

export const tvScreen: Preset = {
  id: "tvScreen",
  label: "Wall screen on stand",
  source: "cutline (layout-editor preset format)",
  // 65" class panel, centre ~1.6 m high
  build: () => [
    box(0, 22, 0, 30, 18, 1.2, "#111418"),
    box(0, 22.6, -0.7, 28.6, 16.8, 0.2, SCREEN),
    box(0, 0, 0.5, 2, 22, 1.5, METAL),
    box(0, 0, 0.5, 14, 0.8, 8, METAL),
  ],
};

export const rug: Preset = {
  id: "rug",
  label: "Round rug",
  source: "cutline (layout-editor preset format)",
  build: () => [part("cyl", [0, 0.1, 0], [70, 0.2, 70], [0, 0, 0], RUG)],
};

export const backdrop: Preset = {
  id: "backdrop",
  label: "Set backdrop panels",
  source: "cutline (layout-editor preset format)",
  build: () => [
    box(0, 0, 0, 140, 60, 2, "#161b22"),
    box(-50, 0, -1.5, 2, 60, 1, "#2a3340"),
    box(50, 0, -1.5, 2, 60, 1, "#2a3340"),
    box(0, 54, -1.5, 140, 1, 1, "#2a3340"),
  ],
};
