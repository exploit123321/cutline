# Cutline — previs tool for live shows

Read this whole file before writing any code. It is the spec for this project and the rules for how to work on it.

## What we are building

A web app for live TV / stream production teams. A producer pastes a messy rundown or script. The app:

1. Turns it into a **shot list spreadsheet**: one row per beat, classified as dialogue, action, visual, cut, cue or note, with the speaker, the shot size and a confidence for each AI-filled field.
2. Places the people and cameras in a **3D studio** at fixed coordinates.
3. Runs a **deterministic cut engine** that picks a camera, a framing and a cut time for every row.
4. Shows a **preview**: the 3D studio on one side and a 2D program monitor on the other, rendering what the active camera sees, stepping through the cuts on play.

Purpose: a portfolio project for an AI-assisted builder role at a live production company. It must look polished, run without setup for a reviewer, and show careful engineering: tests, clear rules, AI used only where it helps.

## The one design rule

**AI reads text. Code does geometry.**

- AI is allowed in exactly one place: turning messy text into classified rows (the classifier).
- Positions, angles, visibility, camera choice, framing, the 180° rule and cut timing are plain TypeScript functions with unit tests. No AI calls there, ever.
- Every AI output is validated against a schema. Anything invalid or low-confidence is flagged for a human, never silently accepted.

If a task seems to need AI outside the classifier, stop and ask.

## How to work

- Build in the stages below, in order. Do not start a stage until the previous one's acceptance checks pass.
- Write the tests for geometry and the cut engine **before or with** the code, not after.
- Run `npm run typecheck`, `npm run lint` and `npm test` before saying a step is done. Report failures honestly; do not mark things done that are not.
- Commit after each working step, with a short message saying what changed.
- Ask before adding any dependency not listed in the stack.
- When a test catches a real bug in generated code, add one line to `docs/bug-log.md`: date, what was wrong, how it was caught, the fix. This log is part of the portfolio.
- Prefer small, pure functions. Comments explain *why*, not *what*.
- Do not invent features outside this spec. Put ideas in `docs/ideas.md` instead.

## Stack

- Vite + React + TypeScript (strict mode, no `any`)
- three.js via `@react-three/fiber` and `@react-three/drei`
- State: `zustand`
- Validation: `zod`
- Tests: `vitest`
- Styling: Tailwind CSS
- Classifier server: a tiny Node server (`hono`) in `server/`, so API keys never reach the browser. Keys read from `.env`: `TYPESAFE_API_KEY` (for Jev) and optionally `ANTHROPIC_API_KEY` (for the `llm` comparison provider). Provide `.env.example`.
- Classifier model: **Jev** by TypeSafe AI (see "Classifier" below).

## Reuse from layout-editor (reference only)

The author's earlier project `exploit123321/layout-editor` has solved some of the 3D problems. Use it as a **read-only reference**: copy ideas and small, clearly useful pieces, never the editor itself. Do not import its 2D editor, zones, routes, ghost mode, model editing, layers, scenes or presentation system.

Worth borrowing:

1. **3D models (set dressing).** Its presets (TV screen, sofa, coffee table, chairs, tables, media console, rug and more) are defined in a `PRESETS = { ... }` object inside `interactive_3d_map.html`, in the format described in its `MODELING_PROMPT.md`: `build()` returns part descriptors `{ kind, c, s, r, color }`, sizes in **map units of 5 cm**, `r` in degrees (Euler XYZ), with `box(x, yBottom, z, w, h, d, color)` and `part(...)` helpers.
   - Write a small adapter in `src/models/` that runs these builders and renders the parts with three.js. **Convert units: metres = map units × 0.05.**
   - Copy only the presets a talk-show set needs into `src/models/presets/`, each with a comment saying where it came from. Keep the licence and attribution consistent with that repo.
   - New models (broadcast camera on a tripod or pedestal, a simple seated and standing human figure) follow the same format; use `MODELING_PROMPT.md` from that repo as the brief.
2. **Split rendering.** Its "dual route" view draws one scene from two cameras into two halves of one canvas with `renderer.setViewport` / `setScissor`. The overview + program monitor here needs the same idea. In React Three Fiber, use drei's `<View>` (one canvas, several views) rather than two separate canvases, so both panels share one scene and one renderer.
3. **Units discipline.** That repo's `AGENTS.md` shows the level of written conventions expected. Keep `docs/decisions.md` in the same spirit, but much shorter.

## Repository layout

```
src/
  model/        types and zod schemas (Studio, Person, Camera, Row, Show)
  geometry/     pure math: vectors, angles, visibility, framing, line side
  models/       preset adapter (5 cm units → metres) and the ported presets
  engine/       cut engine: scoring, rules, timeline
  show/         show state at time t: camera moves, tally, gaze, acts (pure, tested)
  classify/     classifier interface, providers, segmenter, validation
  state/        zustand store
  ui/           panels: Script, Sheet, Studio, Monitor, Timeline
  fixtures/     sample studios and rundowns
server/         classifier endpoint
tests/          vitest tests mirroring src/
docs/           bug-log.md, ideas.md, decisions.md
```

## Coordinate system (do not change)

- Units: metres. Right-handed. `y` is up, floor at `y = 0`.
- `x` to the right, `z` toward the audience / front of the set.
- Yaw in degrees around `y`. Yaw `0` faces `-z` (three.js camera default). Positive yaw turns left (counter-clockwise seen from above).
- Pitch in degrees, positive is up.
- All math functions take and return these units. Convert to radians only inside `geometry/`.

## Data model

```ts
type Vec3 = { x: number; y: number; z: number };

type Person = {
  id: string;            // "anna"
  name: string;          // "Anna Bērziņa"
  aliases: string[];     // ["Anna", "host", "A."]
  position: Vec3;        // feet on the floor
  facingYaw: number;     // where they look by default
  eyeHeight: number;     // metres, default 1.2 seated / 1.65 standing
};

type Camera = {
  id: string;            // "cam2"
  label: string;         // "CAM 2"
  position: Vec3;
  yaw: number;
  pitch: number;
  fovRange: [number, number]; // vertical FOV in degrees, [tightest, widest]
  fixed: boolean;        // fixed cameras cannot change yaw/pitch
};

type Studio = { id: string; name: string; people: Person[]; cameras: Camera[] };

type RowType = "dialogue" | "action" | "visual" | "cut" | "cue" | "note";
type Shot = "close" | "medium" | "wide";

type Row = {
  id: string;
  index: number;
  raw: string;                 // the original text fragment
  type: RowType;
  speakerId: string | null;    // must be a Person id or null
  text: string;                // cleaned line text
  shot: Shot | null;           // requested or suggested
  confidence: { type: number; speakerId: number; shot: number }; // 0..1
  needsReview: boolean;        // true if any confidence < REVIEW_THRESHOLD or validation failed
  locked: boolean;             // user edited; engine and classifier must not overwrite
  // filled by the engine:
  cameraId: string | null;
  fov: number | null;
  start: number | null;        // seconds from show start
  duration: number | null;
  reason: string | null;       // short human-readable why, e.g. "faces speaker, holds 180° line"
};

type Show = { studio: Studio; rows: Row[] };
```

All of these have matching `zod` schemas in `src/model/`. `REVIEW_THRESHOLD = 0.7`, in one constants file.

## Classifier

### Interface

```ts
interface Classifier {
  classify(input: {
    segments: string[];
    studio: Studio;          // gives the allowed speaker ids
  }): Promise<Row[]>;
}
```

Providers, selected in the UI:

1. **`jev`** (the main provider): calls `server/`, which calls Jev. See "Jev classifier" below.
2. **`mock`**: deterministic rules and keyword matching, no network. The app must fully work with this provider so a reviewer without keys can still run it. It is the default only when no Jev key is configured.
3. **`llm`** (comparison only): calls the Anthropic API with a JSON-only prompt listing the allowed types, shots and speaker ids. Exists so `npm run eval` can compare Jev against a normal LLM on accuracy, speed and cost.

### Jev classifier

Jev is a "decision model": it never writes text. It takes a `state` (text) and named, typed `questions`, and returns for each question a choice with a probability per option and a confidence. That matches this task exactly: every segment needs a few decisions from fixed lists.

- **Access:** directly through TypeSafe's own API, with the author's TypeSafe API key (`TYPESAFE_API_KEY` in `.env`). Use TypeSafe's official SDK if one exists for TypeScript/Node, otherwise its HTTP API. The request has a `state` (array of strings) and named, typed `questions`; responses are keyed by question name.
- **Before writing the client, read TypeSafe's official API docs** for the endpoint, the auth header, the current model id, and the exact `choice` and `noul` schemas (how options and criteria are passed). Do not guess field names. Record what you found in `docs/decisions.md`. If the docs cannot be reached, stop and ask.
- **One request per segment, all questions at once:**
  - `type`: `choice` over the six row types, with a one-line definition of each in the criteria.
  - `speaks` and `subject`: two `choice` questions over the studio's person ids plus `"none"`, with each person's name and aliases in the criteria. `speaks` asks who says the words, and `subject` asks who the line shows or describes. Code reads `speaks` on dialogue rows and `subject` on all other rows, because one question that asked both split its answer on lines with two people.
  - `shot`: `choice` over `close`, `medium`, `wide`, `"unspecified"`.
  - Optional `unknown_speaker`: `noul` ("does this line name a speaker who is not in the cast list?"). If yes with probability > 0.5, set `speakerId = null` and flag the row red.
- **State:** the cast list, the previous 5 classified rows (as short text), then the current segment. This is the "loop cascade": each row is decided with the rows before it as context.
- **Text extraction stays deterministic.** Jev cannot return text, so the segmenter strips prefixes like `ANNA:` or `[GFX: ...]` and fills `text`. Jev only decides.
- **Confidence:** map Jev's confidence for each question straight into `Row.confidence`. Below `REVIEW_THRESHOLD`, the cell is yellow. This is the main reason Jev is used: calibrated confidence decides what a human must check.
- **Validate** every response with `zod`. Unknown option, missing question or HTTP error → that field is `null`, confidence `0`, `needsReview = true`. Never retry silently more than once.
- **Speed:** segments are independent except for context, so after the first pass, re-classifying one edited row is a single request. Show the per-row latency, and the cost if the API returns it, in the UI footer.
- The browser never calls Jev directly. Only `server/` holds the key.

### Pipeline

1. **Segment**: split pasted text into segments (lines, sentences, "NAME:" prefixes, bracketed cues like `[CUT TO WIDE]`). Pure function, tested.
2. **Classify in a loop**: process segments in order. Each call gets the current segment plus the previous 5 classified rows as context, so speaker continuity works ("she continues…").
3. **Validate**: unknown speaker ids, invalid enums or missing fields → set the field to `null`, set its confidence to `0`, set `needsReview = true`. Never guess silently.
4. **Respect locks**: re-running classification never overwrites `locked` rows.

### Evaluation

`npm run eval` runs every fixture in `src/fixtures/rundowns/`, and every sample with hand labels, through the selected provider (`--provider jev|llm|mock`, or `--all`) and compares against hand-labelled expected rows. Print accuracy per field and per fixture, average latency, total cost, and every mismatch. Also print how many wrong answers had confidence below `REVIEW_THRESHOLD` (caught by review) versus above it (slipped through), and a calibration table: answers grouped by score, with how many are right, and how many right answers the review flagged. Save each run to `docs/eval/` with the date. The Jev vs LLM table is part of the portfolio.

## Cut engine (deterministic)

Input: `Show`. Output: the same rows with `cameraId`, `fov`, `start`, `duration`, `reason` filled. Same input must always give the same output.

### Geometry helpers (`src/geometry/`)

- `headPosition(person)`: position plus `eyeHeight` on `y`.
- `inView(camera, point, fov)`: the point is inside the camera frustum at that vertical FOV, using the camera's aspect ratio of 16:9. Fixed cameras use their own yaw/pitch. Non-fixed cameras are assumed to aim at the subject.
- `frontality(person, camera)`: angle in degrees between the person's facing direction and the direction from the person to the camera. `0` means the camera sees them straight on.
- `fovForShot(camera, subjectDistance, shot)`: the vertical FOV that frames a visible height of `close = 0.5 m`, `medium = 1.1 m`, `wide = 3.0 m` (or the bounding box of all people in shot plus 20%, whichever is larger), clamped to `fovRange`. Visible height `h = 2 · d · tan(fov / 2)`.
- `lineSide(a, b, point)`: sign of the 2D cross product on the `xz` plane of `(b − a)` and `(point − a)`. Returns `-1`, `0` or `1`.

### Rules, applied per row

1. **Locked rows** keep their camera and timing.
2. **Shot choice** if `shot` is null: dialogue → `medium`; action, visual, cue with several people, or no speaker → `wide`; a `cut` row with explicit text like "close on Anna" → that shot.
3. **Candidate cameras**: subject must be `inView` at the computed FOV, and for close and medium shots `frontality ≤ 60°`.
4. **180° line**: when the last two distinct speakers are A and B, cameras must be on the same side of line A–B as the camera used for the first shot of that exchange. Wide shots may break this only if the row is a `cut` or `cue` that says so.
5. **Scoring** among candidates (higher is better):
   `score = 1.0 · (1 − frontality / 90) + 0.3 · shotMatch − 1.0 · sameAsPrevious`
   where `shotMatch` is `1` if the FOV fits within `fovRange` without clamping, else `0`; `sameAsPrevious` is `1` if this camera was used on the previous row with the same shot size. Ties break by camera id, alphabetically.
6. **No candidate**: fall back to the widest camera that sees everyone. Set `reason` to say so and set `needsReview = true`.
7. **Timing**: dialogue duration = word count / 2.5 seconds, minimum 1.5 s. Other rows default to 2 s. Minimum shot hold is 2 s: if a row is shorter, merge it into the previous shot unless it is a `cut` row. `start` is the cumulative sum.
8. **Reason**: always fill a short sentence with the deciding factors, shown in the sheet and the monitor.
9. **Screen segments**: a `visual` row puts a shared screen on air. Dialogue after it rides on that shot (no cut, reason "On screen: …") until a `cut`, a `cue` or the next `visual`. An `action` inside gets its own reaction shot, and the screen comes back after it.

Every rule above gets at least one unit test with a tiny fixture studio (2 people, 3 cameras) whose correct answer can be checked by hand.

## UI

Single page, three panels, usable at 1280×800 and above (no mobile requirement).

1. **Script**: textarea for the pasted rundown, provider picker (`mock` / `llm`), a "Parse" button, a "Load sample" button.
2. **Sheet**: editable grid of rows. Columns: #, type, speaker, text, shot, camera, start, duration, reason. Cells with confidence below the threshold are highlighted yellow; validation failures red. Editing a cell sets `locked = true` and re-runs the engine. A filter for "needs review only".
3. **Studio + Monitor**: left, a 3D overview with people as simple capsules with name labels, cameras as small bodies with view frustum lines, the active camera highlighted. Right, the program monitor: what goes to air, 16:9: the active camera with its FOV, or the shared screen with the people as cut-out squares; the name strap, subtitles and show bug on top. Camera and shot are shown by the tallies and the sheet, not on the picture.
4. **Timeline** under the preview: blocks per shot, coloured by camera, a playhead, play/pause, and clicking a block jumps there. The sheet highlights the active row.

Studio editing in v1 is through a JSON file in `src/fixtures/studios/`. Drag-to-move people and cameras is stage 5.

Visual style: dark, calm, broadcast-control-room feel. One accent colour for the active camera. No generic dashboard templates.

## Stages and acceptance checks

### Stage 1 — Model and studio view
- Types, zod schemas, constants, one sample studio (talk show: host, two guests, 3 cameras).
- 3D overview renders the studio with labels and frustums.
- Preset adapter with a test that a 20 × 20 × 20 unit box becomes a 1 m cube; the set dressed with a few ported presets (desk or coffee table, chairs or sofa, a screen).
- ✅ Schemas reject a camera with a bad FOV range; the sample studio loads and renders; the unit-conversion test passes.

### Stage 2 — Geometry
- All functions in `geometry/` with tests.
- ✅ Tests prove: frontality is 0 when a person faces a camera directly; `lineSide` flips when the point crosses the line; `fovForShot` returns the expected FOV for a known distance and clamps at both ends.

### Stage 3 — Text to sheet
- Segmenter, `mock` classifier, validation, the Sheet panel, the classify loop with context, locks.
- At least 3 sample rundowns in `src/fixtures/rundowns/` (see sample below), with expected labels.
- The server and the `jev` provider, built from the official API reference.
- `npm run eval` works with the mock and jev providers.
- ✅ Pasting the sample produces rows; an unknown speaker is flagged red; editing a cell locks it and survives a re-parse.

### Stage 4 — Cut engine
- All rules, with tests per rule, then the engine connected to the Sheet.
- ✅ Same input gives identical output twice; a two-person exchange never crosses the line; every row has a reason.

### Stage 5 — Preview and polish
- Program monitor, timeline, play, active-row sync, `llm` comparison provider, and a saved `npm run eval -- --all` report.
- Drag to move people and cameras in the 3D view, re-running the engine live.
- README with a GIF, how to run, the design rule, and a link to `docs/bug-log.md`.
- ✅ A reviewer can `npm install && npm run dev`, press "Load sample", "Parse" and "Play", and see a cut sequence with no API key.

### Stage 6 — Show
- A **Show** mode next to **Plan**: the 3D studio, the program output, a multiview with every camera's own picture, Now/Next, and the transport, all on one playhead.
- Off-air operated cameras pan to their next shot before the cut. People turn to the speaker, and "laughs", "nods" and "turns to X" play out. The video wall follows visual rows. All of this comes from pure functions in `src/show/` with tests. It never changes the engine's decisions.
- Three.js models for people (jointed, seated or standing), cameras (pedestal or tripod, pan/tilt, tally) and the set. The part-list presets remain as the fallback.
- UI in the Peek & Grep design system (tokens, pill switch, rolling digits, motion).
- Shared screens (article, chart, clip, website, poll, comparison, split, recap) drawn in code, with on-screen actions read from the talk (zoom, scroll, click, pause, highlight) and each person as a cut-out square in the corner that keeps the content clear. A second sample, `src/fixtures/samples/podcast-01.txt`, uses them all.
- ✅ Scrubbing to the same time gives the same picture; a fixed camera never moves; an off-air camera is framed on its next shot before the cut.

## Sample rundown (put in `src/fixtures/rundowns/talkshow-01.txt`)

```
OPEN wide on studio, music up
ANNA: Labvakar and welcome back to Evening Desk. tonight we have two guests
Anna turns to Mārtiņš
anna: Mārtiņš, you said last week the budget is a disaster?
M: not a disaster, a missed chance. look at the numbers
[GFX: budget chart full screen]
Laura laughs
LAURA - can I jump in here
cut to close on Laura
Laura: the numbers hide the regional cuts. nobody talks about that
back to anna, she nods
Anna — we'll come back to that after the break
[CUE: break bumper]
```

Expected people for the sample studio: `anna` (host), `martins` (aliases: Mārtiņš, Martins, M), `laura`.

## Non-goals for now

No real camera control, no multi-user editing, no login, no occlusion between people, no audio, no export to broadcast systems. Export the sheet as CSV is fine (stage 5, if time allows).

## Definition of done

- All five stages' checks pass.
- `npm test`, `npm run typecheck` and `npm run lint` are clean.
- The app works offline with the `mock` provider.
- `docs/bug-log.md` has real entries.
- README explains the design rule in the first paragraph.
