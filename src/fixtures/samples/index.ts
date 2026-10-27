import type { Studio } from "../../model/types";
import talkshowScript from "../rundowns/talkshow-01.txt?raw";
import { podcast, talkshow } from "../studios";
import podcastScript from "./podcast-01.txt?raw";

export type Sample = { id: string; label: string; hint: string; studio: Studio; script: string };

/** The rundowns a reviewer can load in one click, each with the studio it is written for. */
export const SAMPLES: Sample[] = [
  { id: "evening-desk", label: "Evening Desk", hint: "Talk show, three guests, one graphic", studio: talkshow, script: talkshowScript },
  { id: "late-line", label: "Late Line", hint: "Three hosts, screen shares: article, chart, clip, site, poll", studio: podcast, script: podcastScript },
];
