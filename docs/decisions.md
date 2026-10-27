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

## Cut engine readings of the spec
- **Shot defaults (rule 2):** dialogue → medium on the speaker; action, visual, cue, note and any speakerless row → wide on everyone. A `cut` with a speaker but no size → medium (the spec does not say; this matches "cut to Anna").
- **Notes are off air:** duration 0, they hold the previous camera. Charging 2 s of show time for a crew note would shift every later cue.
- **The exchange's side (rule 4):** when two people form a new speaker pair, the side is taken from the camera of the first speaker's most recent line (the shot the exchange opened on). If there is none yet, the first camera used inside the exchange sets it. Cameras exactly on the line are allowed.
- **Crossing the line:** only a wide `cut`/`cue` whose text says "cross the line", "reverse" or "other side".
- **Locked rows (rule 1):** a user-chosen camera or duration is kept. Editing a classification field (type, speaker, shot, text) locks the row against the *classifier* but lets the engine re-pick its camera, because the old camera was chosen for the old classification.
- **sameAsPrevious** looks at the previous on-air row, so a note in between does not reset it.
- **Frontality for groups** is the mean over the people in shot.

## Classifier
- Locked rows are matched to new segments by exact raw text, so they survive edits elsewhere in the script and moves within it.
- The LLM sees one segment plus the previous 5 rows per call, as the spec asks. That is many small calls. Fixtures run in parallel in `npm run eval`.
- Unknown speakers: both providers return the unknown name as `speakerId` so validation flags it red, instead of quietly returning `null`.
- Server: `@anthropic-ai/sdk` (the official SDK) with structured output, `effort: "low"` for a short labelling task, and the server-side refusal fallback on models that support it. A refusal or truncated reply becomes a fully flagged row.

## Dependencies beyond the stack list
- `@anthropic-ai/sdk`: the official client for the classifier server.
- `@hono/node-server`: runs the hono app on Node.
- `tsx`: runs the server and `npm run eval` from TypeScript.
- Dev tooling: `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `globals`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `@types/*`.
- No dotenv: Node 22's `process.loadEnvFile` reads `.env`.
