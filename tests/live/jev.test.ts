import { describe, expect, it } from "vitest";
import { hasJevKey, jevClassifySegment, jevModel } from "../../server/jev";
import { validate } from "../../src/classify/validate";
import { talkshow } from "../../src/fixtures/studios";

/*
 * Live tests against the TypeSafe API. They run only with `npm run test:live` and
 * TYPESAFE_API_KEY set (in the environment or in .env). One run costs far below a cent.
 */
const live = describe.skipIf(!hasJevKey());

live(`jev provider (${jevModel()})`, () => {
  it("classifies a dialogue line by an alias", async () => {
    const out = await jevClassifySegment({ segment: "M: not a disaster, a missed chance", context: [], studio: talkshow });
    expect(out).toMatchObject({ type: "dialogue", speakerId: "martins", shot: null, failed: [] });
    expect(out.meta?.costUsd).toBeGreaterThan(0);
  }, 30_000);

  it("flags a speaker who is not in the cast", async () => {
    const seg = "PETERIS: I am not on the guest list";
    const v = validate(await jevClassifySegment({ segment: seg, context: [], studio: talkshow }), seg, talkshow);
    expect(v.speakerId).toBeNull();
    expect(v.invalid).toContain("speakerId");
  }, 30_000);
});
