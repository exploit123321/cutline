import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { createApp } from "../../server/app";
import { ClassifyError, classifySegment } from "../../server/anthropic";
import { systemPrompt, userPrompt, type LlmOutput } from "../../server/prompt";
import { talkshow } from "../../src/fixtures/studios";
import { validate } from "../../src/classify/validate";

const good: LlmOutput = {
  type: "dialogue",
  speakerId: "anna",
  text: "hi",
  shot: null,
  confidence: { type: 0.9, speakerId: 0.9, shot: 0.9 },
};
const body = { segment: "ANNA: hi", context: [], studio: talkshow };
const post = (app: ReturnType<typeof createApp>, b: unknown, provider = "llm") =>
  app.request(`/api/classify/${provider}`, {
    method: "POST",
    body: JSON.stringify(b),
    headers: { "content-type": "application/json" },
  });

describe("classifier server", () => {
  it("reports which providers have a key", async () => {
    const res = await createApp({ jev: { hasKey: () => true }, llm: { hasKey: () => false } }).request("/api/health");
    expect(await res.json()).toMatchObject({ ok: true, jev: true, llm: false });
  });

  it("returns 503 without a key instead of calling the API", async () => {
    let called = false;
    const app = createApp({ llm: { hasKey: () => false, classify: async () => ((called = true), good) } });
    const res = await post(app, body);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: expect.stringContaining("ANTHROPIC_API_KEY") });
    expect(called).toBe(false);
  });

  it("names the TypeSafe key when jev has none", async () => {
    const res = await post(createApp({ jev: { hasKey: () => false } }), body, "jev");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: expect.stringContaining("TYPESAFE_API_KEY") });
  });

  it("returns 404 for an unknown provider", async () => {
    expect((await post(createApp(), body, "gpt")).status).toBe(404);
  });

  it("rejects malformed requests with 400", async () => {
    const app = createApp({ llm: { hasKey: () => true, classify: async () => good } });
    expect((await post(app, { segment: "" })).status).toBe(400);
  });

  it("routes each provider to its own classifier", async () => {
    const app = createApp({
      jev: { hasKey: () => true, classify: async () => ({ ...good, text: "from jev" }) },
      llm: { hasKey: () => true, classify: async () => good },
    });
    expect(await (await post(app, body, "jev")).json()).toMatchObject({ text: "from jev" });
    expect(await (await post(app, body, "llm")).json()).toEqual(good);
  });

  it("maps provider errors to 502", async () => {
    const failing = createApp({
      llm: {
        hasKey: () => true,
        classify: async () => {
          throw new ClassifyError("nope");
        },
      },
    });
    const res = await post(failing, body);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "nope" });
  });
});

describe("classifySegment with a stubbed client", () => {
  const stub = (response: unknown) => ({ beta: { messages: { parse: async () => response } } }) as unknown as Anthropic;

  it("accepts schema-valid output", async () => {
    expect(await classifySegment(body, stub({ stop_reason: "end_turn", parsed_output: good }))).toEqual(good);
  });

  it("rejects output that does not match the schema", async () => {
    await expect(
      classifySegment(body, stub({ stop_reason: "end_turn", parsed_output: { ...good, confidence: undefined } })),
    ).rejects.toThrow(ClassifyError);
  });

  it("passes a bad enum through so validation can null just that field", async () => {
    const out = await classifySegment(body, stub({ stop_reason: "end_turn", parsed_output: { ...good, type: "monologue" } }));
    const v = validate(out, body.segment, talkshow);
    expect(v).toMatchObject({ type: null, speakerId: "anna", invalid: ["type"], needsReview: true });
  });

  it("rejects refusals and truncated output", async () => {
    await expect(classifySegment(body, stub({ stop_reason: "refusal", parsed_output: null }))).rejects.toThrow(/declined/);
    await expect(classifySegment(body, stub({ stop_reason: "max_tokens", parsed_output: null }))).rejects.toThrow(/cut off/);
  });
});

describe("prompt", () => {
  it("lists every allowed speaker id, row type and shot size", () => {
    const p = systemPrompt(talkshow);
    for (const id of ["anna", "martins", "laura"]) expect(p).toContain(`"${id}"`);
    for (const t of ["dialogue", "action", "visual", "cut", "cue", "note"]) expect(p).toContain(t);
    for (const s of ["close", "medium", "wide"]) expect(p).toContain(s);
    expect(p).toMatch(/JSON/);
  });

  it("includes the context rows in order", () => {
    const u = userPrompt("she continues", [
      { type: "dialogue", speakerId: "anna", text: "one", shot: null },
      { type: "dialogue", speakerId: "laura", text: "two", shot: null },
    ]);
    expect(u.indexOf("one")).toBeLessThan(u.indexOf("two"));
    expect(u).toContain("she continues");
  });
});
