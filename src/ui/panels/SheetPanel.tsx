import { useEffect, useRef, useState } from "react";
import { REVIEW_THRESHOLD, ROW_TYPES, SHOTS } from "../../model";
import type { ConfidenceField, Row, Studio } from "../../model/types";
import { rowAt, useStore } from "../../state/store";
import { rowsToCsv } from "../../state/csv";
import type { Edit } from "../../state/edit";

function cellTone(row: Row, field: ConfidenceField): string {
  if (row.invalid.includes(field)) return "bg-invalid-soft text-invalid";
  if (row.confidence[field] < REVIEW_THRESHOLD) return "bg-review-soft text-review";
  return "";
}

const fmt = (n: number | null, digits = 1) => (n === null ? "—" : n.toFixed(digits));

function TextCell({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="w-full bg-transparent outline-none focus:text-ink-100"
    />
  );
}

const selectCls = "w-full cursor-pointer appearance-none bg-transparent outline-none [&>option]:bg-ink-900";

function SheetRow({ row, studio, active, engineShot, onEdit, onSeek }: {
  row: Row;
  engineShot: string | undefined;
  studio: Studio;
  active: boolean;
  onEdit: (e: Edit) => void;
  onSeek: () => void;
}) {
  const ref = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);
  const conf = `confidence · type ${row.confidence.type.toFixed(2)} · speaker ${row.confidence.speakerId.toFixed(2)} · shot ${row.confidence.shot.toFixed(2)}`;
  return (
    <tr
      ref={ref}
      className={`border-b border-ink-800 align-top ${active ? "bg-tally-soft" : "hover:bg-ink-850"}`}
      title={`${conf}\nraw: ${row.raw}`}
    >
      <td className={`relative py-1.5 pl-3 pr-2 font-mono text-ink-400 ${active ? "text-ink-100" : ""}`}>
        {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-tally" />}
        <button onClick={onSeek} className="hover:text-ink-100" title="Jump here">
          {row.index + 1}
        </button>
        {row.locked && <span className="ml-1 text-[10px] text-ink-300" title="Edited by you; never overwritten">●</span>}
      </td>
      <td className={`px-2 py-1.5 ${cellTone(row, "type")}`}>
        <select
          value={row.type ?? ""}
          onChange={(e) => onEdit({ field: "type", value: e.target.value as (typeof ROW_TYPES)[number] })}
          className={selectCls}
        >
          {row.type === null && <option value="">invalid</option>}
          {ROW_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </td>
      <td className={`px-2 py-1.5 ${cellTone(row, "speakerId")}`}>
        <select
          value={row.speakerId ?? ""}
          onChange={(e) => onEdit({ field: "speakerId", value: e.target.value || null })}
          className={selectCls}
        >
          <option value="">{row.invalid.includes("speakerId") ? "unknown" : "—"}</option>
          {studio.people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name.split(" ")[0]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1.5 text-ink-200">
        <TextCell value={row.text} onCommit={(v) => onEdit({ field: "text", value: v })} />
      </td>
      <td className={`px-2 py-1.5 ${cellTone(row, "shot")}`}>
        <select
          value={row.shot ?? ""}
          onChange={(e) => onEdit({ field: "shot", value: (e.target.value || null) as Row["shot"] })}
          className={selectCls}
        >
          <option value="">{engineShot ? `auto · ${engineShot}` : "auto"}</option>
          {SHOTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1.5 font-mono text-ink-200">
        <select
          value={row.cameraId ?? ""}
          onChange={(e) => onEdit({ field: "cameraId", value: e.target.value })}
          className={selectCls}
        >
          {studio.cameras.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-ink-300">{fmt(row.start)}</td>
      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-ink-300">
        <input
          type="number"
          step={0.5}
          min={0}
          value={row.duration ?? 0}
          onChange={(e) => onEdit({ field: "duration", value: Number(e.target.value) })}
          className="w-12 bg-transparent text-right outline-none [appearance:textfield]"
        />
      </td>
      <td className={`px-2 py-1.5 pr-3 text-[11px] leading-snug ${row.needsReview ? "text-review" : "text-ink-400"}`}>
        {row.reason}
      </td>
    </tr>
  );
}

export function SheetPanel() {
  const { plan, studio, reviewOnly, setReviewOnly, edit, time, setTime } = useStore();
  const active = rowAt(plan, time);
  const rows = reviewOnly ? plan.rows.filter((r) => r.needsReview) : plan.rows;
  const review = plan.rows.filter((r) => r.needsReview).length;

  const download = () => {
    const blob = new Blob([rowsToCsv(plan.rows, studio)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cutline-shot-list.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-ink-900">
      <div className="flex items-center gap-4 border-b border-ink-700 px-4 py-2">
        <h2 className="panel-title">Shot list</h2>
        <div className="flex items-center gap-3 text-[11px] text-ink-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-review-soft ring-1 ring-review" /> low confidence
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-invalid-soft ring-1 ring-invalid" /> failed validation
          </span>
          <span>● edited (locked)</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-300">
            <input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} className="accent-review" />
            Needs review only ({review})
          </label>
          <button
            onClick={download}
            disabled={!plan.rows.length}
            className="rounded border border-ink-600 px-2 py-1 text-xs text-ink-300 hover:text-ink-100 disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {plan.rows.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-ink-500">
            Paste a rundown, or press “Load sample”, then “Parse”.
          </div>
        ) : (
          <table className="w-full table-fixed border-collapse text-xs">
            <colgroup>
              <col className="w-12" />
              <col className="w-24" />
              <col className="w-24" />
              <col />
              <col className="w-28" />
              <col className="w-20" />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-[30%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-ink-900 text-left text-[10px] uppercase tracking-wider text-ink-500">
              <tr className="border-b border-ink-700">
                <th className="py-2 pl-3 font-semibold">#</th>
                <th className="px-2 font-semibold">Type</th>
                <th className="px-2 font-semibold">Speaker</th>
                <th className="px-2 font-semibold">Text</th>
                <th className="px-2 font-semibold">Shot</th>
                <th className="px-2 font-semibold">Camera</th>
                <th className="px-2 text-right font-semibold">Start</th>
                <th className="px-2 text-right font-semibold">Dur</th>
                <th className="px-2 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <SheetRow
                  key={r.id}
                  row={r}
                  studio={studio}
                  active={active?.id === r.id}
                  engineShot={plan.shots[r.id]}
                  onEdit={(e) => edit(r.id, e)}
                  onSeek={() => r.start !== null && setTime(r.start)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
