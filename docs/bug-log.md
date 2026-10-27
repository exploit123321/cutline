# Bug log

Real bugs found in generated code while building Cutline. Date — what was wrong — how it was caught — the fix.

## Caught by tests

_None yet._ Every test failure during the build so far was in the test itself, not the code under test: a `-0` vs `0` deep-equal, and a figure test that measured the top of the head instead of eye height. Both tests were corrected, not the code.

## Caught outside the test suite

- 2026-10-27 — The program monitor rendered from the scene origin for the first shot after **Parse**. The camera pose was set in a `useLayoutEffect` through a ref, and drei's `<View>` mounts its children after that effect runs, so the ref was still `null`. — Caught by a headless-browser screenshot of the first frame. — Fix: pass `position`, `rotation` (order `YXZ`) and `fov` as props on `<PerspectiveCamera>` (`src/ui/MonitorView.tsx`).
- 2026-10-27 — Monitor lower label and PGM tally were invisible: the shared full-screen canvas painted over them. — Caught by the same screenshot check. — Fix: `z-10` on the overlays.
- 2026-10-27 — When a new speaker pair formed, the 180° side was computed against the *previous* pair's line (the helper read `this.line` before it was replaced). — Caught reading the code before the rule-4 tests ran. — Fix: `sideOf(camera, a, b)` takes the pair explicitly (`src/engine/index.ts`).
- 2026-10-27 — The LLM output schema used `z.enum` for row type and shot, assuming the API enforces it. Printing the SDK's generated JSON schema showed that enums become description hints, so a bad enum made the whole row fail parsing instead of nulling one field. — Caught by inspecting `zodOutputFormat` output. — Fix: the server schema checks structure only, and `validate()` nulls and flags the bad field. A test now covers it (`tests/server/app.test.ts`).
- 2026-10-27 — Armchair and sofa backrests were built on the front (−z) side, so seated figures faced into the backrest. — Caught reading the preset against the "models face −z" convention. — Fix: backrests at +z.
