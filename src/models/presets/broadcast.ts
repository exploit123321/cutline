import { box, cyl, part, type Preset } from "../format";

/*
 * New models for Cutline, written to the layout-editor MODELING_PROMPT.md brief
 * (part descriptors, 5 cm units, facing -z, standing on y = 0).
 */

const BODY = "#2b2f36";
const DARK = "#15181d";
const PED = "#4a505a";
const SKIN = "#c9a68a";
const SHIRT = "#46566b";
const TROUSERS = "#23272e";

export const pedestalCamera: Preset = {
  id: "pedestalCamera",
  label: "Studio camera on pedestal",
  source: "cutline (new, layout-editor MODELING_PROMPT.md brief)",
  // lens centre at y ≈ 28 units (1.4 m); callers offset to the real camera height
  build: () => [
    cyl(0, 0, 0, 14, 1.5, PED), // base
    cyl(0, 1.5, 0, 3, 23, PED), // column
    box(0, 24.5, 1, 6, 6, 9, BODY), // body
    part("cyl", [0, 28, -5], [3.2, 5, 3.2], [90, 0, 0], DARK), // lens, pointing -z
    box(0, 30.5, 2, 4, 2.5, 4, DARK), // viewfinder
    part("box", [-4, 26, 7], [0.8, 0.8, 8], [-20, 0, 0], PED), // pan bar
  ],
};

export const seatedFigure: Preset = {
  id: "seatedFigure",
  label: "Seated person",
  source: "cutline (new, layout-editor MODELING_PROMPT.md brief)",
  // eyes at y ≈ 24 units (1.2 m)
  build: () => [
    box(-2, 0, -6, 2.6, 9, 2.6, TROUSERS), // shins
    box(2, 0, -6, 2.6, 9, 2.6, TROUSERS),
    box(0, 9, -2.5, 7, 2.6, 9, TROUSERS), // thighs
    box(0, 11, 0.5, 8, 10, 4.5, SHIRT), // torso
    box(-5, 13, -1, 2.2, 7, 2.6, SHIRT), // arms
    box(5, 13, -1, 2.2, 7, 2.6, SHIRT),
    cyl(0, 21, 0.5, 2.2, 1.5, SKIN), // neck
    part("sphere", [0, 24.5, 0.3], [4.6, 5.6, 5], [0, 0, 0], SKIN), // head
  ],
};

export const standingFigure: Preset = {
  id: "standingFigure",
  label: "Standing person",
  source: "cutline (new, layout-editor MODELING_PROMPT.md brief)",
  // eyes at y ≈ 33 units (1.65 m)
  build: () => [
    box(-1.8, 0, 0, 2.8, 17, 2.8, TROUSERS),
    box(1.8, 0, 0, 2.8, 17, 2.8, TROUSERS),
    box(0, 17, 0, 8, 12, 4.5, SHIRT),
    box(-5, 18, 0, 2.2, 11, 2.6, SHIRT),
    box(5, 18, 0, 2.2, 11, 2.6, SHIRT),
    cyl(0, 29, 0, 2.2, 1.5, SKIN),
    part("sphere", [0, 33.3, 0], [4.6, 5.6, 5], [0, 0, 0], SKIN),
  ],
};
