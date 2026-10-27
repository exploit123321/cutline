import type { CSSProperties, ReactNode } from "react";
import type { ScreenContent, ScreenState } from "../../show";

/*
 * What the shared screen shows, one component per kind. Everything is drawn in code
 * (no stock images, works offline) and sized in cqw of the program picture, so it scales
 * with the monitor. The ScreenState drives the interaction: zoom, scroll, highlight,
 * cursor and the clip's play head.
 */

type Props = { c: ScreenContent; s: ScreenState };

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** "Jan 1200" → { label: "Jan", value: 1200 } */
function points(items: string[]): { label: string; value: number }[] {
  return items
    .map((it) => /^(.*?)\s*(-?\d+(?:[.,]\d+)?)\s*%?$/.exec(it.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ label: (m[1] ?? "").trim(), value: Number((m[2] ?? "0").replace(",", ".")) }));
}

function zoomStyle(zoom: number, origin: string, k = 0.5): CSSProperties {
  return { transform: `scale(${1 + k * zoom})`, transformOrigin: origin };
}

/** A generic night-city picture with a bus, used by the article, the clip and pictures. */
function NightScene({ shift = 0, className = "" }: { shift?: number; className?: string }) {
  const bus = 8 + ((shift * 5) % 120);
  return (
    <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" className={className}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1430" />
          <stop offset="1" stopColor="#1e2b55" />
        </linearGradient>
      </defs>
      <rect width="160" height="90" fill="url(#sky)" />
      {Array.from({ length: 11 }, (_, i) => {
        const h = 22 + ((i * 37) % 30);
        return <rect key={i} x={i * 15 - 4} y={62 - h} width="13" height={h} fill="#141c33" />;
      })}
      {Array.from({ length: 40 }, (_, i) => (
        <rect key={i} x={(i * 17) % 155 + 2} y={20 + ((i * 29) % 34)} width="1.6" height="2" fill="#ffd58a" opacity={(i * 7) % 3 ? 0.75 : 0.2} />
      ))}
      <rect y="62" width="160" height="28" fill="#0d0f17" />
      <rect y="74" width="160" height="0.8" fill="#f2b84b" opacity="0.5" />
      {[20, 70, 120].map((x) => (
        <g key={x}>
          <rect x={x} y="34" width="0.8" height="30" fill="#3a3f4a" />
          <circle cx={x + 0.4} cy="34" r="5" fill="#ffd58a" opacity="0.12" />
          <circle cx={x + 0.4} cy="34" r="1.2" fill="#ffe2b0" />
        </g>
      ))}
      <g transform={`translate(${bus} 56)`}>
        <rect width="34" height="14" rx="2" fill="#2f6fe4" />
        {Array.from({ length: 6 }, (_, i) => (
          <rect key={i} x={3 + i * 5} y="2.5" width="3.6" height="4.5" rx="0.5" fill="#ffe7a6" />
        ))}
        <rect x="1" y="9" width="32" height="1" fill="#ffffff" opacity="0.35" />
        <circle cx="8" cy="14" r="2.4" fill="#0b0b0e" />
        <circle cx="27" cy="14" r="2.4" fill="#0b0b0e" />
        <text x="30" y="5.6" fontSize="3" fill="#fff" fontWeight="700">
          N9
        </text>
      </g>
    </svg>
  );
}

function Cursor({ from, to, travel, click }: { from: [number, number]; to: [number, number]; travel: number; click: number }) {
  const x = from[0] + (to[0] - from[0]) * travel;
  const y = from[1] + (to[1] - from[1]) * travel;
  return (
    <>
      {click > 0 && (
        <span
          className="pointer-events-none absolute rounded-full border-[0.3cqw] border-[#5b7cfa]"
          style={{
            left: `${to[0]}%`,
            top: `${to[1]}%`,
            width: "5cqw",
            height: "5cqw",
            transform: `translate(-50%, -50%) scale(${0.3 + click})`,
            opacity: 1 - click,
          }}
        />
      )}
      <svg className="pointer-events-none absolute z-10 h-[2.6cqw] w-[2.6cqw] drop-shadow" style={{ left: `${x}%`, top: `${y}%` }} viewBox="0 0 24 24">
        <path d="M3 2l7 19 2.6-7.6L20 11z" fill="#fff" stroke="#111" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </>
  );
}

function Article({ c, s }: Props) {
  const m = /(\d+(?:[.,]\d+)?\s?%?)/.exec(c.title);
  const before = m ? c.title.slice(0, m.index) : c.title;
  const figure = m?.[1] ?? "";
  const after = m ? c.title.slice(m.index + figure.length) : "";
  const lines = (n: number, seed: number) =>
    Array.from({ length: n }, (_, i) => (
      <div key={i} className="mt-[1.1cqw] h-[1.1cqw] rounded-full bg-[#d9d6cf]" style={{ width: `${70 + ((seed * 13 + i * 29) % 30)}%` }} />
    ));
  return (
    <div className="absolute inset-0 bg-[#f4f2ee] text-[#16181d]">
      <div className="relative z-10 flex h-[6.5cqw] items-center justify-between bg-[#14213d] px-[4cqw] text-white">
        <span className="font-strap text-[3.2cqw] font-extrabold uppercase tracking-wide">Riverside Daily</span>

      </div>
      <div className="absolute inset-x-0 bottom-0 top-[6.5cqw] overflow-hidden" style={zoomStyle(s.zoom, "38% 18%", 0.55)}>
        <div className="mx-auto w-[66cqw] pt-[3cqw]" style={{ transform: `translateY(${-s.scroll * 24}cqw)` }}>
          <div className="text-[1.4cqw] font-bold uppercase tracking-[0.14em] text-[#c8102e]">Transport</div>
          <h1 className="mt-[0.8cqw] text-[4.4cqw] font-bold leading-[1.05]">
            {before}
            {figure && (
              <mark className="rounded-[0.3cqw] px-[0.3cqw] text-inherit" style={{ background: `rgba(255, 214, 10, ${0.15 + 0.75 * s.zoom})` }}>
                {figure}
              </mark>
            )}
            {after}
          </h1>
          <div className="mt-[1cqw] text-[1.4cqw] text-[#5b6070]">By our transport reporter · 4 min read</div>
          <NightScene className="mt-[1.6cqw] h-[20cqw] w-full rounded-[0.5cqw]" />
          {lines(4, 1)}
          {figure && (
            <div className="my-[2cqw] border-l-[0.6cqw] border-[#c8102e] pl-[2cqw]">
              <div className="font-strap text-[7cqw] font-extrabold leading-none text-[#c8102e]">{figure}</div>
              <div className="mt-[0.6cqw] text-[2.2cqw] font-semibold">{after.trim()}</div>
            </div>
          )}
          {lines(6, 2)}
        </div>
      </div>
    </div>
  );
}

function Chart({ c, s }: Props) {
  const given = points(c.items);
  const seed = hash(c.title);
  const data = given.length >= 2 ? given : ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"].map((label, i) => ({ label, value: 30 + ((seed >> (i * 4)) & 63) }));
  const max = Math.max(...data.map((d) => d.value)) * 1.15;
  const grow = smooth(s.local / 1.1);
  const first = data[0]?.value ?? 1;
  const last = data.at(-1)?.value ?? 1;
  const change = Math.round(((last - first) / Math.max(first, 1e-9)) * 100);
  return (
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#16244a,#070a13_75%)] text-white">
      <div className="absolute left-[6cqw] top-[4cqw]">
        <div className="text-[1.4cqw] font-semibold uppercase tracking-[0.16em] text-[#8ea9ff]">The numbers</div>
        <div className="mt-[0.6cqw] text-[3.4cqw] font-bold">{c.title}</div>
      </div>
      <div className="absolute bottom-[8cqw] left-[6cqw] right-[6cqw] top-[14cqw]" style={zoomStyle(s.zoom, "85% 40%", 0.45)}>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <div key={g} className="absolute inset-x-0 border-t border-white/10" style={{ bottom: `${g * 100}%` }}>
            <span className="absolute -top-[1.4cqw] left-0 text-[1.1cqw] text-white/40">{Math.round(max * g).toLocaleString("en-US")}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2cqw] pl-[5cqw]">
          {data.map((d, i) => {
            const isLast = i >= data.length - 3;
            return (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end">
                <div className="mb-[0.6cqw] text-[1.4cqw] font-semibold text-white/85" style={{ opacity: grow }}>
                  {Math.round(d.value * grow).toLocaleString("en-US")}
                </div>
                <div
                  className="w-full rounded-t-[0.5cqw]"
                  style={{
                    height: `${(d.value / max) * 100 * grow}%`,
                    background: isLast ? "linear-gradient(180deg,#ffb35c,#e0603a)" : "linear-gradient(180deg,#8ea9ff,#3d5bd1)",
                  }}
                />
                <div className="mt-[0.8cqw] text-[1.4cqw] text-white/70">{d.label}</div>
              </div>
            );
          })}
        </div>
        {/* the drawn circle around the jump, and its size */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          <ellipse
            cx="80"
            cy="42"
            rx="21"
            ry="44"
            fill="none"
            stroke="#ffd60a"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - s.highlight}
            style={{ strokeWidth: 4 }}
          />
        </svg>
        <div
          className="absolute right-[1cqw] top-[-4.5cqw] rounded-[0.5cqw] bg-[#ffd60a] px-[1cqw] py-[0.3cqw] font-strap text-[3cqw] font-extrabold text-[#0b0b0e]"
          style={{ opacity: s.highlight, transform: `translateY(${(1 - s.highlight) * 30}%)` }}
        >
          {change > 0 ? "+" : ""}
          {change}%
        </div>
      </div>
    </div>
  );
}

/** Seconds into the clip where it starts playing. */
const CLIP_CUE = 18;

function Clip({ c, s }: Props) {
  const m = /^(\d+):(\d{2})$/.exec(c.items[0] ?? "");
  const duration = m ? Number(m[1]) * 60 + Number(m[2]) : 60;
  // the clip is cued up a little way in, as a producer would, so "go back" has room
  const time = Math.min(duration, CLIP_CUE + s.clipTime);
  const fmt = (x: number) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, "0")}`;
  const rewound = s.segment.actions.some((a) => a.kind === "rewind" && s.local + s.segment.start >= a.start);
  return (
    <div className="absolute inset-0 bg-black">
      <div className="absolute inset-x-0 bottom-[6cqw] top-0 overflow-hidden" style={zoomStyle(s.zoom, "55% 60%", 0.3)}>
        <div className="absolute inset-0" style={{ transform: `scale(${1.06 + time * 0.003}) translateX(${-time * 0.08}%)` }}>
          <NightScene shift={time} className="h-full w-full" />
        </div>
        <div className="absolute left-[3cqw] top-[2.5cqw] rounded-[0.4cqw] bg-black/55 px-[1.2cqw] py-[0.5cqw] text-[1.6cqw] font-semibold text-white">{c.title}</div>
        {s.paused && (
          <div className="absolute inset-0 grid place-items-center bg-black/30">
            <div className="flex flex-col items-center gap-[0.8cqw] text-white">
              <svg viewBox="0 0 24 24" className="h-[7cqw] w-[7cqw] opacity-90">
                <rect x="5" y="4" width="5" height="16" rx="1" fill="currentColor" />
                <rect x="14" y="4" width="5" height="16" rx="1" fill="currentColor" />
              </svg>
              <span className="text-[1.6cqw] font-semibold tracking-[0.2em]">{rewound ? "◀◀ BACK 3 S" : "PAUSED"}</span>
            </div>
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex h-[6cqw] items-center gap-[1.6cqw] bg-[#111318] px-[2.4cqw] text-white">
        <span className="text-[2cqw]">{s.paused ? "▶" : "❚❚"}</span>
        <span className="num w-[11cqw] text-[1.5cqw] text-white/80">
          {fmt(time)} / {fmt(duration)}
        </span>
        <div className="relative h-[0.6cqw] flex-1 rounded-full bg-white/20">
          <div className="absolute inset-y-0 left-0 rounded-full bg-[#ff453a]" style={{ width: `${(time / duration) * 100}%` }} />
          <div className="absolute top-1/2 h-[1.4cqw] w-[1.4cqw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ left: `${(time / duration) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function Website({ c, s }: Props) {
  const url = c.title;
  const heading = c.items[0] ?? "Timetable";
  const rows = ["N1", "N3", "N4", "N7", "N9", "N12"].map((r, i) => ({ r, from: ["23:05", "23:20", "23:40", "00:10", "00:25", "01:00"][i], every: [20, 30, 30, 20, 15, 40][i] }));
  const clicked = (s.cursor?.click ?? 0) > 0.5 || s.segment.actions.some((a) => a.kind === "click" && s.local + s.segment.start > a.start + 1.1);
  return (
    <div className="absolute inset-0 bg-[#e9ebef]">
      <div className="flex h-[4.6cqw] items-center gap-[1.2cqw] px-[2cqw]">
        {["#ff5f57", "#febc2e", "#28c840"].map((col) => (
          <span key={col} className="h-[1cqw] w-[1cqw] rounded-full" style={{ background: col }} />
        ))}
        <div className="ml-[1cqw] flex h-[2.8cqw] flex-1 items-center gap-[0.8cqw] rounded-full bg-white px-[1.6cqw] text-[1.5cqw] text-[#3a3f4a]">
          <span className="text-[1.2cqw]">🔒</span>
          {url}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 top-[4.6cqw] overflow-hidden bg-white" style={zoomStyle(s.zoom, "80% 45%", 0.4)}>
        <div style={{ transform: `translateY(${-s.scroll * 12}cqw)` }}>
          <div className="flex h-[6cqw] items-center justify-between bg-[#0f5c4d] px-[4cqw] text-white">
            <span className="font-strap text-[2.8cqw] font-extrabold uppercase tracking-wide">Riverside Transit</span>
            <span className="flex gap-[2.4cqw] text-[1.4cqw] opacity-85">
              <span>Routes</span>
              <span>Tickets</span>
              <span className="font-semibold underline">Night</span>
            </span>
          </div>
          <div className="flex gap-[3cqw] px-[4cqw] pt-[3cqw] text-[#16181d]">
            <div className="flex-1">
              <h2 className="text-[3.6cqw] font-bold">{heading}</h2>
              <div className="mt-[0.6cqw] text-[1.5cqw] text-[#5b6070]">Every night, 23:00 to 05:00</div>
              <div className="mt-[2cqw] overflow-hidden rounded-[0.6cqw] border border-[#dfe2e8] text-[1.6cqw]">
                <div className="grid grid-cols-3 bg-[#f3f5f8] px-[1.6cqw] py-[0.8cqw] font-semibold text-[#5b6070]">
                  <span>Route</span>
                  <span>First</span>
                  <span>Every</span>
                </div>
                {rows.map((r) => (
                  <div key={r.r} className={`grid grid-cols-3 border-t border-[#eef0f3] px-[1.6cqw] py-[0.9cqw] ${r.r === "N9" && clicked ? "bg-[#fff7d1]" : ""}`}>
                    <span className="font-bold text-[#0f5c4d]">{r.r}</span>
                    <span>{r.from}</span>
                    <span>{r.every} min</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="w-[26cqw] rounded-[0.8cqw] border border-[#dfe2e8] p-[1.8cqw] shadow-sm">
              <div className="text-[1.3cqw] font-semibold uppercase tracking-[0.14em] text-[#5b6070]">Live map</div>
              {clicked ? (
                <div className="mt-[1.2cqw]">
                  <div className="flex items-center gap-[0.8cqw] text-[2.2cqw] font-bold text-[#0f5c4d]">
                    <span className="live-dot h-[1.2cqw] w-[1.2cqw] rounded-full bg-[#28c840]" />
                    N9 · 4 min
                  </div>
                  <div className="mt-[0.6cqw] text-[1.4cqw] text-[#5b6070]">Riverside Square, stop C</div>
                  <NightScene className="mt-[1.2cqw] h-[10cqw] w-full rounded-[0.5cqw]" shift={s.local} />
                </div>
              ) : (
                <div className="mt-[1.2cqw] rounded-[0.6cqw] bg-[#0f5c4d] py-[1.2cqw] text-center text-[1.7cqw] font-semibold text-white">Show live map</div>
              )}
            </div>
          </div>
        </div>
      </div>
      {s.cursor && <Cursor from={[42, 78]} to={[83, 37]} travel={s.cursor.travel} click={s.cursor.click} />}
    </div>
  );
}

function Poll({ c, s }: Props) {
  const answers = points(c.items);
  const live = smooth(s.local / 2.6);
  const votes = Math.round(12480 * smooth(s.local / 3.2) + Math.max(0, s.local - 3.2) * 37);
  const colours = ["#30d158", "#ff453a", "#8ea9ff", "#ffd60a"];
  return (
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_10%,#1d2b55,#070a13_70%)] px-[7cqw] pt-[5cqw] text-white">
      <div className="flex items-center gap-[1cqw] text-[1.5cqw] font-bold uppercase tracking-[0.2em] text-[#ff8a7a]">
        <span className="live-dot h-[1.1cqw] w-[1.1cqw] rounded-full bg-[#ff453a]" />
        Live poll
      </div>
      <div className="mt-[1cqw] text-[4.2cqw] font-bold leading-tight">{c.title}</div>
      <div className="mt-[3cqw] flex w-[62cqw] flex-col gap-[2cqw]">
        {answers.map((a, i) => (
          <div key={a.label}>
            <div className="flex items-baseline justify-between text-[2.2cqw] font-semibold">
              <span>{a.label}</span>
              <span className="num">{Math.round(a.value * live)}%</span>
            </div>
            <div className="mt-[0.6cqw] h-[2cqw] overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${a.value * live}%`, background: colours[i % colours.length] }} />
            </div>
          </div>
        ))}
      </div>
      <div className="num mt-[2.4cqw] text-[1.6cqw] text-white/60">{votes.toLocaleString("en-US")} votes</div>
    </div>
  );
}

function RouteMap({ after }: { after: boolean }) {
  const base = [
    [10, 70],
    [30, 62],
    [48, 66],
    [62, 50],
  ];
  const extra = [
    [76, 40],
    [86, 26],
    [92, 14],
  ];
  const all = after ? [...base, ...extra] : base;
  const line = (pts: number[][]) => pts.map((p) => p.join(",")).join(" ");
  return (
    <svg viewBox="0 0 100 80" className="h-full w-full">
      <rect width="100" height="80" fill="#eef1e8" />
      <path d="M0 30 Q30 20 50 34 T100 28" stroke="#b9d5f2" strokeWidth="6" fill="none" />
      {Array.from({ length: 6 }, (_, i) => (
        <line key={i} x1={i * 20} y1="0" x2={i * 20 - 10} y2="80" stroke="#dde2d6" strokeWidth="1" />
      ))}
      <polyline points={line(base)} stroke="#0f5c4d" strokeWidth="2.4" fill="none" strokeLinejoin="round" />
      {after && <polyline points={line([base.at(-1) as number[], ...extra])} stroke="#e0603a" strokeWidth="2.4" fill="none" strokeLinejoin="round" />}
      {all.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2" fill="#fff" stroke={i >= base.length ? "#e0603a" : "#0f5c4d"} strokeWidth="1.2" />
      ))}
    </svg>
  );
}

function Compare({ c, s }: Props) {
  const [left = "Before", right = "After"] = c.items;
  const panel = (label: string, after: boolean) => (
    <div className="relative flex-1 overflow-hidden rounded-[0.8cqw] bg-white shadow-lg">
      <RouteMap after={after} />
      <span className={`absolute left-[1.2cqw] top-[1.2cqw] rounded-[0.4cqw] px-[1cqw] py-[0.3cqw] font-strap text-[2.2cqw] font-extrabold uppercase tracking-wide text-white ${after ? "bg-[#e0603a]" : "bg-[#3a3f4a]"}`}>
        {label}
      </span>
    </div>
  );
  return (
    <div className="absolute inset-0 bg-[#10131b] text-white">
      <div className="px-[4cqw] pt-[3cqw] text-center text-[3cqw] font-bold">{c.title}</div>
      {/* the gap in the middle is where the people's squares go */}
      <div className="absolute inset-x-[4cqw] bottom-[4cqw] top-[9cqw] flex gap-[15cqw]" style={zoomStyle(s.zoom, "50% 55%", 0.06)}>
        {panel(left, false)}
        {panel(right, true)}
      </div>
    </div>
  );
}

function TopicCard({ c, s }: Props) {
  return (
    <div className="absolute inset-0 flex flex-col justify-center bg-[linear-gradient(160deg,#16244a,#0a0e1a)] px-[4cqw] text-white">
      <div className="text-[1.4cqw] font-bold uppercase tracking-[0.22em] text-[#8ea9ff]">New topic</div>
      <div className="mt-[1cqw] font-strap text-[5.6cqw] font-extrabold uppercase leading-[0.95]">{c.title}</div>
      {c.items[0] && <div className="mt-[1cqw] text-[2.2cqw] text-white/75">{c.items[0]}</div>}
      <NightScene className="mt-[2.4cqw] h-[16cqw] w-full rounded-[0.6cqw]" shift={s.local} />
    </div>
  );
}

function Recap({ c, s, brand }: Props & { brand: string }) {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#22346d,#070a13_70%)] px-[8cqw] pt-[7cqw] text-white">
      <div className="font-strap text-[2.2cqw] font-extrabold uppercase tracking-[0.3em] text-[#8ea9ff]">{brand}</div>
      <div className="mt-[1cqw] text-[4.6cqw] font-bold">{c.title}</div>
      <div className="mt-[3cqw] flex flex-col gap-[1.8cqw]">
        {c.items.map((it, i) => {
          const on = smooth((s.local - 0.5 - i * 0.6) / 0.5);
          return (
            <div key={it} className="flex items-center gap-[1.6cqw] text-[3cqw] font-semibold" style={{ opacity: on, transform: `translateX(${(1 - on) * -3}cqw)` }}>
              <span className="grid h-[3.4cqw] w-[3.4cqw] place-items-center rounded-full bg-[#30d158] text-[2cqw] text-[#0b0b0e]">✓</span>
              {it}
            </div>
          );
        })}
      </div>
      <div className="absolute bottom-[5cqw] left-[8cqw] text-[1.8cqw] text-white/55">Same time next week</div>
    </div>
  );
}

function Picture({ c, s }: Props) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#0d0f14]">
      <div className="w-[70cqw] overflow-hidden rounded-[0.8cqw] bg-white p-[1cqw] shadow-2xl" style={zoomStyle(s.zoom, "50% 50%", 0.35)}>
        <NightScene className="h-[32cqw] w-full" />
        <div className="px-[0.6cqw] pt-[1cqw] text-[2cqw] font-semibold text-[#16181d]">{c.title}</div>
      </div>
    </div>
  );
}

export function ScreenBody({ c, s, brand }: Props & { brand: string }): ReactNode {
  switch (c.kind) {
    case "article":
      return <Article c={c} s={s} />;
    case "chart":
      return <Chart c={c} s={s} />;
    case "clip":
      return <Clip c={c} s={s} />;
    case "website":
      return <Website c={c} s={s} />;
    case "poll":
      return <Poll c={c} s={s} />;
    case "compare":
      return <Compare c={c} s={s} />;
    case "split":
      return <TopicCard c={c} s={s} />;
    case "recap":
      return <Recap c={c} s={s} brand={brand} />;
    default:
      return <Picture c={c} s={s} />;
  }
}
