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
- `speaks` and `subject` keep the spec's `"none"` option. The docs suggest a separate noul for "none of the above". The live probe got "none" right on cues and graphics, so the noul was not necessary.
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

## Subtitles and font (2026-10-27)
- **Subtitles** come from `subtitleAt(plan, t)` in `src/show/`: the dialogue line on air, split into cues of at most `SUB_MAX` (64) characters, so most cues fit on one line at the subtitle size. Cues break at sentence ends first. A short sentence (under a third of the space) joins the next, so a "Yes." does not flash up alone. A sentence too long for one cue splits into cues of equal length, so there is no two-word orphan. Each cue gets screen time in proportion to its words. The text goes into sentence case, because rundowns are often typed in lower case. On screen the format is `Name: text`, with the first name in the speaker's colour (`src/ui/speakers.ts`: yellow, cyan, pink, green…, kept away from tally red and preview green).
- **Afacad everywhere**, code-like text included. Its digits are equal width by default, so timecodes do not jitter. The font is bundled from `@fontsource-variable/afacad` (OFL-1.1), so the app stays offline. Canvas text (3D labels, the video wall) is drawn into textures, so it is drawn in the fallback font until Afacad has loaded and then drawn again (`useCanvasFont`). The base size is 14 px, because Afacad sets smaller than Segoe UI.

## Program picture, lower-third (2026-10-27)
- **Only on-air content in the picture.** The camera, shot and reason moved from a burned-in label to a strip under the picture. The picture keeps the PGM tally, graphics, the lower-third and subtitles.
- **Lower-third** (name strap) on each person's first line, in two tiers: the show block and the name, then a shorter role bar from the left edge, both with angled ends and 85% opaque. It is set in Big Shoulders Display, a condensed news face. It sits low at the left, at 70% of its first size, just above the subtitle line.
- **The strap leaves on the edit.** It stays at least `STRAP_MIN` (3 s). Then it leaves on the first cut (a camera change; a reframe on the same camera does not count) or the first phrase change (a row starts or ends, or a subtitle cue changes), at the latest after `STRAP_MAX` (7 s). On a cut it goes out with the picture. On a phrase change its wipe ends as the next cue starts. All of this is timed from the playhead (`strapWindows`, `strapAt`), so scrubbing and recorded frames match.
- **Subtitles are always centred at the bottom**, with no box and no outline: a soft dark halo (layered text shadows) keeps them readable, white screens included. The lower-third and the people's squares sit just above the subtitle line, so nothing has to move around the subtitles.
- **Show layout.** Now/Next is only as tall as its content (status, NOW, NEXT), and the multiview keeps its 16:9 tiles. The program takes the largest 16:9 that fits the rest of the column (a size container with `min(100cqw, (100cqh − strip) · 16/9)`).

## Shared screens (2026-10-27)
- **Where the rule lives.** The engine knows only that a `visual` row starts a screen segment and that talk rides on it (rule 9 in `CLAUDE.md`), so the cut list and the timeline match what goes to air. Everything visual is in `src/show/screen.ts`: segments, content kind, on-screen actions and timing, all pure functions of `(plan, t)` with tests.
- **Rundown syntax.** `[SCREEN: kind | title | item | item…]`, for example `[SCREEN: poll | Should the night bus stay? | Yes 64 | No 21]`. The kind is read from the first part (article, chart, clip, website, poll, compare, split, recap; anything else is a picture). Plain graphics lines such as `[GFX: budget chart full screen]` still work.
- **Actions come from the talk.** "right here", "take a look" or "see what I mean" zoom in. "Scroll" scrolls. "Click" moves the cursor and clicks. "This?" points. "Increase" or "numbers" circles the jump and keeps it drawn. "Pause" stops the clip, and "go back" steps it back 3 s. A laugh inside a segment is a reaction shot of the studio.
- **The people are cut-out squares**: one virtual iso camera per person, square, 1.6 m in front of the face, the person alone on a dark tint of their subtitle colour. The iso camera is virtual, so it never takes one of the three studio cameras, which the cut list may need. The speaker's square is larger and framed in their colour. The squares go to the corner the content leaves clear (a chart's newest values are on the right, so the squares go left; on a comparison they stack in the gap between the pictures; a split has none).
- **Layering.** The 3D views share one canvas above the page. So the screen paints under the canvas (no z-index), the squares draw on the canvas on top of it, and the studio feed is narrowed to the part of the frame the screen leaves (`screenWipe`). The screen pushes the studio off to the left as it comes in, and uncovers it from the right as it goes.
- **Visuals are drawn in code**: a news page, a bar chart, a video player, a cropped browser, a poll, route maps, a topic card and a recap. Nothing is downloaded, and nothing claims to be a real publication. The city, paper and transit site are invented.
- **Room.** Floor, drape walls and a ceiling grid close the studio (36 × 36 × 10 m). The orbit limits keep the eye inside it, so no angle shows empty space.
- **Second sample.** `Late Line` is the user's script turned into a rundown: three hosts (Alex, Jamie, Sam, with the optional `role` field on Person) and eight screen moments. It is in the eval set (see "Eval" below).

## Briefs, not only rundowns (2026-10-27)
- **The cast comes from the script.** Before anything is classified, `detectCast` reads speaker names in code: a one-word prefix (`ALEX:`, `M:`), or a name before a verb of speech and quoted words (`Jamie could say “…”`). If the studio's cast covers fewer than half of them, Parse switches to the sample studio whose cast covers at least three quarters, or else puts the names on the current seats (set, cameras and props stay). The Rundown panel says which happened.
- **Two more Jev questions, decided in code.** `general_advice` ("is this advice for the whole show, rather than something placed at this point?") and `quote_is_line` ("does this give, in quotes, words a cast member says on air?") go in the same request as the others. Truth table: quoted words above 0.7 make the row dialogue, with the quoted words as its text. Otherwise, advice above 0.7 makes it an off-air note. Advice between 0.3 and 0.7 keeps Jev's type but caps its confidence at 0.6, so the row is flagged for a human. Below 0.3, Jev's type stands.
- **How the wording was checked.** Both questions were probed live on the 71 segments of the author's brief before they went in: quoted lines scored 0.95–0.99, the "Before"/"After" labels 0.07; style advice 0.8–0.97, placed moments ("show the poll here") 0.03–0.2. The labelled rundowns still score 37/37. No wording was tuned to single lines.
- **Text.** Wrapping quotes are dropped from a line (`Alex: “So…”` → `So…`). When Jev says the quotes are spoken words, the row's text is just the quoted words, so subtitles show what is said, not the note around it. A note that becomes a screen gets a short title for its kind ("Article", "The numbers") instead of the whole sentence as a headline.

## Eval: a labelled brief, calibration, two speaker questions (2026-10-27)
- **Two more labelled sets.** `brief-01` is the author's director's brief: 71 paragraphs, labelled with the author. `podcast-01` (Late Line) has labels next to the sample, made from the rules that the sample was written with. An expected file is a plain list for the talk-show studio, or `{ studio, rows }` for another cast. `npm run eval` reads `src/fixtures/rundowns/` and every sample with labels.
- **Label rules for briefs**, agreed with the author. Quoted words for a cast member make the row dialogue for that person, also when the paragraph has a cut or a screen too. A shot direction at a point in the show is a wide cut, also when it is worded as a suggestion. An opening shot is a cut (the talk show's "OPEN … music up" stays a cue for its music). A reaction (laughs, reacts, scrolls) is an action for the person named. Talk with no quoted words, and advice for the whole show, are notes, with no speaker and no shot.
- **Calibration table.** Each report groups every answer by the score that the review used, in bands split at 0.7, and shows how many are right. It also counts "flagged but right": right answers below 0.7, which a human checks for nothing. Invalid (red) fields are left out, because their score is 0 by rule. Jev's bands match their accuracy (for example, 0.70–0.90: 87% right at a mean score of 0.81), so the threshold stays at 0.7.
- **Speaker as two questions.** `speaker` asked who "speaks, acts, or gets the shot", so lines with two people split its answer. "ALEX: Jamie, what do you actually think?" scored 0.51, and a screen that Jamie introduced scored 0.41. Now `speaks` (who says the words) is read on dialogue, and `subject` (who the line shows or describes) on all other rows. Those Late Line rows now score 0.97–1.00. Over all 162 rows, the speaker went from 158 to 159 right, and wrong speakers past the review went from 1 to 0. Before: `docs/eval/2026-10-27T19-30-05-jev.md`. After: `…T19-31-35-jev.md`.
- **Noise.** Jev is not fully deterministic. Two runs of the same code differed by one type answer, and "flagged but right" moved by up to 4. A change of one row is not a result.
- **What is left.** All Jev misses are in the brief, and most are the type. Some suggestions read as notes ("Maybe later … display the graph full-screen" gives note, the label is visual). Some advice reads as placed ("Maybe the screen should slide in…" gives visual, the label is note). Two notes get the person they name as speaker, and one note gets the shot size it names.
- **Tried and dropped: "a note has no speaker and no shot".** It is true by definition, because a note is off air. But code can apply it only to the type that the provider answered. On the brief, the type is the weakest field, so the rule spreads type errors into the other fields. Jev, same 162 rows, wrong answers and slipped through:
  - No rule: 19 wrong, 6 slipped.
  - Rule on every note: 22 wrong, 7 slipped. It fixed 3 answers, but cleared the right speaker or shot on 5 rows that Jev wrongly typed as notes. For example, "Sam could react…" lost Sam.
  - Rule on sure notes only (type at or above 0.7): 20 wrong, 6 slipped. It fixed 1 shot and lost 1 speaker. Mock is the same with or without it, because no mock note scores 0.7.

  Reports: `docs/eval/2026-10-27T19-38-03-mock-jev.md` and `…T19-39-08-mock-jev.md`. The better target is the type on briefs: suggestions and advice.

## Performance (2026-10-27)
Measured with headless Chrome on the author's RTX 3060, playing the *Late Line* sample: Show went from 30 to 51–58 fps and Plan from 18 to about 90 fps, with no shader links during playback (there were 398 in 6 s).
- **Lines that change every frame do not use drei's `<Line>`**, which disposes its material whenever its points change. The frustums rewrite a fixed-size buffer in place.
- **Shared GPU resources are never disposed by React.** Each view's content sits in a `<group dispose={null}>`, because R3F disposes every material and geometry on an unmounting mesh, including the shared ones.
- **Views are hidden, not unmounted.** A covered program feed, idle cut-out squares and the multiview tiles stay mounted and use drei's `visible` prop. The cut flash is an overlay keyed by the cut, so a tile's 3D view is never rebuilt. Mounting a view clones rigged people and compiles shaders, which stalls a frame.
- **Only the parts that move follow the clock.** The set and people are memoised. The sheet re-renders when the active row changes (memoised rows), the script panel takes a shallow pick, and the timeline's blocks re-render on a cut, while only the timecode and playhead follow every frame.

## Dependencies beyond the stack list
- `@typesafe-ai/sdk`: the official Jev client (the spec asks for it if it exists).
- `@fontsource-variable/afacad`: the UI font, self-hosted (asked and approved 2026-10-27).
- `@fontsource-variable/big-shoulders-display`: the lower-third font, self-hosted (requested by the author 2026-10-27).
- `@anthropic-ai/sdk`: the official client for the llm comparison provider.
- `@hono/node-server`: runs the hono app on Node.
- `tsx`: runs the server and `npm run eval` from TypeScript.
- Dev tooling: `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `globals`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `@types/*`.
- No dotenv: Node 22's `process.loadEnvFile` reads `.env`.
