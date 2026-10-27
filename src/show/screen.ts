import type { Plan } from "../engine";
import type { Row } from "../model/types";

/*
 * Shared-screen segments: what the program shows while an article, chart, clip, website,
 * poll, comparison or recap is up, with the people as cut-out squares on top. A visual row
 * opens a segment; talk keeps it up; a cut, a cue or the next visual ends it. An action
 * inside (a laugh) is a reaction shot, and the screen comes back after it. Pure functions
 * of (plan, t), like the rest of src/show.
 */

export type ScreenKind = "article" | "chart" | "clip" | "website" | "poll" | "compare" | "split" | "recap" | "image";

export type ScreenContent = {
  kind: ScreenKind;
  title: string;
  /** the parts after the title: chart points, poll answers, labels, recap items… */
  items: string[];
};

/** Which corner the people's squares take, so they do not cover what matters. */
export type Corner = "right" | "left" | "centre" | "none";

const KINDS: [RegExp, ScreenKind][] = [
  [/\b(split|beside|side panel)\b/, "split"],
  [/\b(poll|vote|votes|comments)\b/, "poll"],
  [/\b(compare|comparison|before|after|side by side)\b/, "compare"],
  [/\b(chart|graph|numbers|stats|statistics)\b/, "chart"],
  [/\b(clip|video|vt|footage)\b/, "clip"],
  [/\b(website|browser|site|web|url)\b/, "website"],
  [/\b(article|headline|news|story)\b/, "article"],
  [/\b(recap|closing|outro|summary)\b/, "recap"],
];

const cap = (s: string) => (s ? s[0]?.toUpperCase() + s.slice(1) : s);

/** "article | Night buses carry…" or plain "budget chart full screen" → kind, title, items. */
export function screenContent(text: string): ScreenContent {
  const parts = text.split("|").map((p) => p.trim()).filter(Boolean);
  const head = (parts[0] ?? "").toLowerCase();
  const kind = KINDS.find(([re]) => re.test(head))?.[1] ?? KINDS.find(([re]) => re.test(text.toLowerCase()))?.[1] ?? "image";
  if (parts.length > 1) return { kind, title: parts[1] as string, items: parts.slice(2) };
  const title = text.replace(/\b(full[\s-]?screen|fs|on screen)\b/gi, "").replace(/\s+/g, " ").trim();
  return { kind, title: cap(title) || "Graphics", items: [] };
}

export const CORNER: Record<ScreenKind, Corner> = {
  article: "right",
  // the latest values (and the highlight) sit at the right of a chart
  chart: "left",
  clip: "right",
  // the timetable's live panel sits on the right of the page
  website: "left",
  poll: "right",
  // the squares go in the gap between the two pictures
  compare: "centre",
  // the people are already half the frame
  split: "none",
  recap: "right",
  image: "right",
};

export type ActionKind = "zoom" | "highlight" | "scroll" | "click" | "point" | "pause" | "rewind";

/** What a line of talk does to the screen. One line can do several things. */
const ACTIONS: [RegExp, ActionKind][] = [
  [/\b(right here|look here|zoom|take a look|see what i mean|look at (this|that|these))\b/, "zoom"],
  [/\b(increase|bigger|spike|numbers|jump|higher)\b/, "highlight"],
  [/\bscroll\b/, "scroll"],
  [/\bclick\b/, "click"],
  [/\b(this|that) (one)?\?|^this\?/, "point"],
  [/\bpause\b/, "pause"],
  [/\bgo back\b|\brewind\b/, "rewind"],
];

export type ScreenAction = { kind: ActionKind; start: number; end: number };
type Span = { start: number; end: number; speakerId: string | null };

export type ScreenSegment = {
  rowId: string;
  start: number;
  end: number;
  content: ScreenContent;
  /** reaction shots inside the segment: the program shows the studio for these */
  reactions: { start: number; end: number }[];
  actions: ScreenAction[];
  /** each line of talk while the screen is up, for the speaker's square */
  talk: Span[];
};

const onAir = (r: Row) => r.start !== null && r.duration !== null && r.duration > 0;

export function actionsOf(text: string): ActionKind[] {
  const t = text.toLowerCase().trim();
  return ACTIONS.filter(([re]) => re.test(t)).map(([, k]) => k);
}

export function buildScreens(plan: Plan): ScreenSegment[] {
  const out: ScreenSegment[] = [];
  let cur: ScreenSegment | null = null;
  const close = (at: number) => {
    if (cur) out.push({ ...cur, end: at });
    cur = null;
  };
  const rows = plan.rows.filter(onAir);
  for (const r of rows) {
    const start = r.start as number;
    const end = start + (r.duration as number);
    if (r.type === "visual") {
      close(start);
      cur = { rowId: r.id, start, end, content: screenContent(r.text), reactions: [], actions: [], talk: [] };
      continue;
    }
    if (!cur) continue;
    if (r.type === "cut" || r.type === "cue") {
      close(start);
      continue;
    }
    const seg: ScreenSegment = cur;
    if (r.type === "action") seg.reactions.push({ start, end });
    if (r.type === "dialogue") {
      seg.talk.push({ start, end, speakerId: r.speakerId });
      for (const kind of actionsOf(r.text)) seg.actions.push({ kind, start, end });
    }
    seg.end = end;
  }
  const last = rows.at(-1);
  close(last ? (last.start as number) + (last.duration as number) : 0);
  return out;
}

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Screen transitions: the screen slides in over this time, and out over the second. */
export const SCREEN_IN = 0.6;
export const SCREEN_OUT = 0.35;

export type ScreenState = {
  segment: ScreenSegment;
  /** 0..1 sliding in, and 0..1 sliding out */
  enter: number;
  exit: number;
  /** a reaction shot is on: the studio fills the program for now */
  reaction: boolean;
  /** seconds since the screen came up */
  local: number;
  zoom: number;
  highlight: number;
  /** how many scrolls have happened, eased, e.g. 1.4 */
  scroll: number;
  /** cursor travel 0..1 and click ripple 0..1, while a click or point is on */
  cursor: { travel: number; click: number } | null;
  /** clip time in seconds: plays, stops on "pause", steps back on "go back" */
  clipTime: number;
  paused: boolean;
  /** who is talking now, for their square */
  speakerId: string | null;
};

/** A rise over `rise` seconds from the start, held while the line lasts, then a fall. */
function envelope(t: number, a: ScreenAction, rise: number, fall: number): number {
  if (t < a.start) return 0;
  if (t <= a.end) return smooth((t - a.start) / rise);
  return smooth(1 - (t - a.end) / fall);
}

export function screenAt(segments: ScreenSegment[], t: number): ScreenState | null {
  const segment = segments.find((s) => t >= s.start && t < s.end);
  if (!segment) return null;
  const acts = segment.actions;
  const of = (k: ActionKind) => acts.filter((a) => a.kind === k);

  const zoom = Math.max(0, ...of("zoom").map((a) => envelope(t, a, 0.8, 0.6)));
  // a highlight stays drawn once it is drawn, until the screen goes
  const highlight = Math.max(0, ...of("highlight").map((a) => (t < a.start ? 0 : smooth((t - a.start) / 0.7))));
  const scroll = of("scroll").reduce((n, a) => n + (t < a.start ? 0 : smooth((t - a.start) / 1)), 0);

  const pointer = [...of("click"), ...of("point")].filter((a) => t >= a.start && t < a.end + 0.6).at(-1);
  const cursor = pointer
    ? { travel: smooth((t - pointer.start) / 0.7), click: pointer.kind === "click" ? smooth((t - pointer.start - 0.7) / 0.35) : 0 }
    : null;

  // the clip plays from the start of the segment, stops at "pause", steps back 3 s on "go back"
  const pause = of("pause").find((a) => t >= a.start);
  const playedUntil = pause ? Math.min(t, pause.start) : t;
  const back = of("rewind")
    .filter((a) => t >= a.start)
    .reduce((s, a) => s + 3 * smooth((t - a.start) / 0.6), 0);
  const clipTime = Math.max(0, playedUntil - segment.start - back);

  const talk = segment.talk.find((s) => t >= s.start && t < s.end);
  return {
    segment,
    enter: smooth((t - segment.start) / SCREEN_IN),
    exit: 1 - smooth((segment.end - t) / SCREEN_OUT),
    reaction: segment.reactions.some((r) => t >= r.start && t < r.end),
    local: t - segment.start,
    zoom,
    highlight,
    scroll,
    cursor,
    clipTime,
    paused: pause !== undefined,
    speakerId: talk?.speakerId ?? null,
  };
}
