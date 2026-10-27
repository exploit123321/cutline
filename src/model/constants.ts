/** Any AI-filled confidence below this marks the row for human review. */
export const REVIEW_THRESHOLD = 0.7;

/** Program output is always 16:9. */
export const ASPECT = 16 / 9;

/** Visible height in metres each shot size should frame. */
export const SHOT_HEIGHT = { close: 0.5, medium: 1.1, wide: 3.0 } as const;

/** Shots shorter than this are merged into the previous shot (except explicit cuts). */
export const MIN_HOLD = 2;
export const DEFAULT_DURATION = 2;
export const DIALOGUE_MIN_DURATION = 1.5;
export const WORDS_PER_SECOND = 2.5;

/** Close and medium shots need to see the face; beyond this the subject is in profile or turned away. */
export const MAX_FRONTALITY = 60;

/** Context window for the classify loop: how many previous rows each call sees. */
export const CLASSIFY_CONTEXT = 5;
