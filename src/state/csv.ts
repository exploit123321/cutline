import type { Row, Studio } from "../model/types";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function rowsToCsv(rows: Row[], studio: Studio): string {
  const head = ["#", "type", "speaker", "text", "shot", "camera", "fov", "start", "duration", "needs_review", "reason"];
  const name = (id: string | null) => studio.people.find((p) => p.id === id)?.name ?? "";
  const cam = (id: string | null) => studio.cameras.find((c) => c.id === id)?.label ?? "";
  const lines = rows.map((r) =>
    [
      r.index + 1,
      r.type,
      name(r.speakerId),
      r.text,
      r.shot,
      cam(r.cameraId),
      r.fov?.toFixed(1),
      r.start?.toFixed(2),
      r.duration?.toFixed(2),
      r.needsReview ? "yes" : "",
      r.reason,
    ]
      .map(cell)
      .join(","),
  );
  return [head.join(","), ...lines].join("\n");
}
