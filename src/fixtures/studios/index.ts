import { StudioSchema } from "../../model/schema";
import type { Studio } from "../../model/types";
import talkshowJson from "./talkshow.json";

/** Studios are edited as JSON; parsing here means a typo fails loudly at load time. */
export function loadStudio(json: unknown): Studio {
  return StudioSchema.parse(json);
}

export const talkshow: Studio = loadStudio(talkshowJson);
