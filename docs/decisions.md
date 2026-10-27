# Decisions

Short, dated notes on choices that are not obvious from the code. Units and axes are fixed in `CLAUDE.md`; this file covers everything else.

## Units and frames
- Metres everywhere outside `src/models/`. Presets are authored in 5 cm map units and converted once in `src/models/adapter.ts` (`MAP_UNIT_M = 0.05`).
- Degrees in every public function. Radians only inside `src/geometry/` and at the three.js boundary (`rotation={[0, yaw * DEG, 0]}`).
- `forward(yaw, pitch) = (−sin yaw · cos pitch, sin pitch, −cos yaw · cos pitch)`. This matches three.js `rotation.y`, so a model built facing −z and rotated by `yaw` faces the studio yaw.

## Data model
- `Row.type` is nullable. Validation sets an invalid field to `null` (spec: "set the field to null"), and that includes the type.
- `Row.invalid: ("type" | "speakerId" | "shot")[]` records which fields failed validation, so the sheet can tell "low confidence" (yellow) from "validation failed" (red).
- `Studio.props` (preset id, position, yaw) dresses the set. It is visual only; the engine ignores it (no occlusion, per the non-goals).

## Geometry
- `frontality` is measured on the floor plane. A camera slightly above eye line still sees the face, and this keeps "faces the camera = 0°" exact.
- `inView` for an operated (non-fixed) camera aims at a target (default: the point itself). For group shots the target is the centroid of the heads, and every head must be in frame.
- `groupHeight` projects heads onto the plane through the centroid and converts horizontal spread to an equivalent height (÷ 16:9), then adds 20%.

## Presets
- `exploit123321/layout-editor` was not reachable from the build environment (private repo), so `src/models/presets/` holds fresh builders that follow its documented contract: `build()` → `{ kind, c, s, r, color }` parts, 5 cm units, `box(x, yBottom, z, w, h, d, color)` / `part(...)` helpers, facing −z. Each preset file says this in its header. Replacing them with the ported originals needs no adapter change.

## Rendering
- One `<Canvas>` with drei `<View>`s. Each view mounts the same `<StudioSet>` component from the same store, so both panels render identical data with one renderer.
- Labels are canvas-texture sprites, not drei `<Text>`, because `<Text>` downloads a font and the app must work offline.
