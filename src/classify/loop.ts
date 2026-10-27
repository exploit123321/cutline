import { CLASSIFY_CONTEXT } from "../model/constants";
import type { Row, Studio } from "../model/types";
import type { ClassifyOne, Classifier, ContextRow } from "./types";
import { failedClassification, validate } from "./validate";

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function emptyEngineFields(): Pick<Row, "cameraId" | "fov" | "start" | "duration" | "reason"> {
  return { cameraId: null, fov: null, start: null, duration: null, reason: null };
}

const toContext = (r: Row): ContextRow => ({ type: r.type, speakerId: r.speakerId, text: r.text, shot: r.shot });

/**
 * Classify segments in order. Each call sees the previous CLASSIFY_CONTEXT rows so
 * speaker continuity works. Locked rows from `previous` are matched by their raw text
 * and reused as-is (they also serve as context), never re-classified.
 */
export async function classifyAll(
  segments: string[],
  studio: Studio,
  classifyOne: ClassifyOne,
  previous: Row[] = [],
): Promise<Row[]> {
  const lockedPool = previous.filter((r) => r.locked);
  const rows: Row[] = [];
  for (const [index, seg] of segments.entries()) {
    const lockIdx = lockedPool.findIndex((r) => r.raw === seg);
    if (lockIdx >= 0) {
      const [kept] = lockedPool.splice(lockIdx, 1);
      rows.push({ ...(kept as Row), index });
      continue;
    }
    const context = rows.slice(-CLASSIFY_CONTEXT).map(toContext);
    let fields;
    try {
      fields = validate(await classifyOne({ segment: seg, context, studio }), seg, studio);
    } catch {
      fields = failedClassification(seg);
    }
    rows.push({
      id: `row-${index}-${hash(seg)}`,
      index,
      raw: seg,
      ...fields,
      locked: false,
      ...emptyEngineFields(),
    });
  }
  return rows;
}

export function makeClassifier(classifyOne: ClassifyOne): Classifier {
  return {
    classify: ({ segments, studio, previous }) => classifyAll(segments, studio, classifyOne, previous),
  };
}
