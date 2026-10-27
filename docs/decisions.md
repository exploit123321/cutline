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
- Unknown speakers: mock and llm return the unknown name as `speakerId`, and validation flags it red. Jev cannot return text, so it answers a `noul` ("does this line name a speaker who is not in the cast?"). Above 0.5, the server lists `speakerId` in `failed`, and validation nulls it and flags it red.
- `RawClassification.failed` lists the fields that a provider could not decide (a missing or malformed answer, an unknown speaker). Validation treats them the same as a field that failed its own checks.
- Server: `@anthropic-ai/sdk` (the official SDK) with structured output, `effort: "low"` for a short labelling task, and the server-side refusal fallback on models that support it. A refusal or truncated reply becomes a fully flagged row.

## Jev (TypeSafe), read from docs.typesafe.ai on 2026-10-27
- Endpoint `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer $TYPESAFE_API_KEY`. The official SDK `@typesafe-ai/sdk` 0.7.0 (`TypeSafeClient.systemOne`) reads that key from the environment. The server calls Jev through the SDK.
- Request: `{ model, state, questions }`. `questions` maps names that we select to `{ type: "choice", instructions, criteria: { option: description } }` or `{ type: "noul", instructions, criteria: { true, false } }`. The model sees the option names and descriptions, but not the question names.
- Response: `{ model, answers, usage: { input_tokens, output_tokens } }`. A choice answer is `{ choice, confidence, probabilities }`. A noul answer is `{ noul }`, the probability of yes.
- Model: pinned to `jev-1.14.0` (`TYPESAFE_DEFAULT_MODEL` overrides it), because `jev-latest` moves when a new version ships. Price: $0.042 per million input tokens, output is free. The footer and eval compute the cost from `usage.input_tokens`.
- Retries: the SDK retries 429, 5xx and connection errors two times by default. We set `maxRetries: 1`, because the spec allows one silent retry at most.
- State: `{ show, cast, previous_lines, line }`. With no context rows, `previous_lines` is a sentence, not an empty list, because the docs warn that an empty list can read as a signal.
- `speaker` keeps the spec's `"none"` option. The docs suggest a separate noul for "none of the above". The live probe got "none" right on cues and graphics, so the noul was not necessary.
- All wording is in `server/jev-questions.ts`. The first eval run got 37 of 37 correct, so no wording was tuned to the fixtures.

## Show and models (2026-10-27)
- **One clock.** Playback lives in `usePlayback`, mounted once in `App`, so Plan and Show share the playhead. Everything that moves reads it: `src/show/` turns `(plan, studio, t)` into camera aims, tally states, gaze, acts and the wall picture. No state carries from frame to frame, so a scrub and a playthrough land on the same picture.
- **Camera moves off air only.** An operated camera holds its last shot after it leaves program, pans to its next shot over `MOVE_TIME` (1.6 s), and settles `SETTLE_TIME` (0.25 s) before the cut. Two blocks in a row on one camera reframe on air over 0.6 s. The engine's aims and FOVs are the end points, so the animation never changes a decision.
- **Gaze rules.** A speaker looks at a cast member named in the line, else at the other half of the current exchange, else at the live camera. A listener looks at the speaker, else at the last speaker. "X turns to Y" holds until X speaks again. A head turns over 0.45 s. The neck takes 70% of the turn and the torso 30%, limited to ±80°.
- **Models are three.js, not part lists.** The part-list format cannot express joints, so people and cameras are React components with hinged groups. The part-list presets and their adapter stay for anything without a detailed model (`DETAILED` in `SetPieces.tsx` maps preset ids). Geometry and materials are module-level singletons, because each drei `<View>` mounts its own copy of the scene.
- **One environment map.** A per-view `<Environment>` prefiltered the same cube five times on the first frame. One `RoomEnvironment` map is now built per renderer and shared, with no download.
- **Shadows only in the big views.** Each view renders its own shadow map, so the overview and program cast shadows and the multiview tiles do not. Measured 66 fps in Show at 1252 px wide with all five views running.
- **Design system.** Tokens, button styles, motion keyframes, `SegmentedControl` and `RollingNumber` are ported from the author's Peek & Grep (MIT). Broadcast colours sit on top: tally red for program, green for preview. The blue accent marks interaction and the person talking.

## Realistic people (2026-10-27)
- **Source.** The author's own Meshy AI people, rigged with a Mixamo skeleton (`D:\tsak\meshy-library\curated\people`). `scripts/prepare_people.py` makes them web-sized: 2048 px JPEG textures instead of 4096 px PNG, no animation clips, and a plain lit material instead of Meshy's self-lit one (emissive copy of the texture, metalness 1). Each file went from about 17 MB to 2.8 MB. Cast: Anna `woman_green_sweater`, Mārtiņš `man_knit_sweater`, Laura `woman_camel_coat`. Other studios get the three models in turn.
- **Seating without animation clips.** `SeatedRig` resets the skeleton to its bind pose from the inverse bind matrices (the file's node transforms can hold a frame of a run cycle). Then it turns each bone by the smallest rotation that points it at its child along a target direction in model space. This avoids Mixamo's per-bone local axes. Gaze, nods and laughs are extra rotations about the model's up and right axes, split over chest (25%), neck (30%) and head (45%). The shins are aimed once so that the ankles land 8.5 cm above the floor.
- **Fallback.** While a model loads, or if it fails, the built figure stands in (`Suspense` and an error boundary). Standing people (eye height ≥ 1.45 m) keep the built figure, because the rig only seats.
- **Cost.** Each view gets a `SkeletonUtils.clone`. Geometry and textures are shared, so five views hold one copy of each texture. Frustum culling is off on the people, because their bounding spheres come from the standing bind pose.

## Dependencies beyond the stack list
- `@typesafe-ai/sdk`: the official Jev client (the spec asks for it if it exists).
- `@anthropic-ai/sdk`: the official client for the llm comparison provider.
- `@hono/node-server`: runs the hono app on Node.
- `tsx`: runs the server and `npm run eval` from TypeScript.
- Dev tooling: `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `globals`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `@types/*`.
- No dotenv: Node 22's `process.loadEnvFile` reads `.env`.
