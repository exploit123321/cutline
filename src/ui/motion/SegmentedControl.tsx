import { useEffect, useLayoutEffect, useRef, useState } from "react";

/*
 * Ported from Peek & Grep (frontend/src/components/motion/SegmentedControl.tsx, MIT, same author).
 * A pill slides to the active option. A dark copy of the labels is clipped to the pill, so
 * letters invert while the pill passes over them (R05 Exclusion Tabs). A soft light follows
 * the pointer across the bar (R38 Flashlight Tabs).
 */

export type SegmentOption<T extends string> = { id: T; label: string; hint?: string; dot?: string };

type Props<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
};

export function SegmentedControl<T extends string>({ options, value, onChange, size = "md", className }: Props<T>) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [rect, setRect] = useState({ left: 0, width: 0, wrap: 0, ready: false });
  const [glow, setGlow] = useState({ x: 0, y: 0, on: false });
  const activeIndex = Math.max(0, options.findIndex((o) => o.id === value));
  // the first measurement places the pill without a slide; later changes animate
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    if (!rect.ready || animate) return;
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [rect.ready, animate]);

  useLayoutEffect(() => {
    const measure = () => {
      const el = itemRefs.current[activeIndex];
      const wrap = wrapRef.current;
      if (!el || !wrap) return;
      // measured against the bar, so the pill lines up with its label at any zoom
      const box = el.getBoundingClientRect();
      const outer = wrap.getBoundingClientRect();
      const k = outer.width ? wrap.offsetWidth / outer.width : 1;
      setRect({ left: (box.left - outer.left) * k, width: box.width * k, wrap: wrap.offsetWidth, ready: true });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [activeIndex, options.length]);

  const h = size === "sm" ? "h-7 text-[12px]" : "h-8 text-[12.5px]";
  const pad = size === "sm" ? "px-2.5" : "px-3.5";
  const clipRight = Math.max(0, rect.wrap - rect.left - rect.width);
  const transition = animate ? "320ms var(--ease-spring)" : "0ms";
  const face = "linear-gradient(180deg, #eef0f8, #d6d9e6)";

  const labels = (dark: boolean) =>
    options.map((opt, i) => (
      <button
        key={opt.id}
        ref={dark ? undefined : (el) => void (itemRefs.current[i] = el)}
        type="button"
        tabIndex={dark ? -1 : 0}
        aria-hidden={dark || undefined}
        aria-pressed={dark ? undefined : opt.id === value}
        title={opt.hint}
        onClick={() => onChange(opt.id)}
        className={`relative z-[1] inline-flex items-center gap-1.5 ${h} ${pad} whitespace-nowrap rounded-full font-medium transition-colors duration-150 ${
          dark ? "text-[#0d0e14]" : "text-fg-3 hover:text-fg"
        }`}
      >
        {opt.dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: opt.dot }} />}
        {opt.label}
      </button>
    ));

  return (
    <div
      ref={wrapRef}
      className={`relative inline-flex select-none items-center rounded-full p-0.5 ${className ?? ""}`}
      style={{ background: "var(--color-elev)", boxShadow: "inset 0 0 0 1px var(--color-line)" }}
      onPointerMove={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        setGlow({ x: e.clientX - box.left, y: e.clientY - box.top, on: true });
      }}
      onPointerLeave={() => setGlow((g) => ({ ...g, on: false }))}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full transition-opacity duration-300"
        style={{
          opacity: glow.on ? 1 : 0,
          background: `radial-gradient(70px circle at ${glow.x}px ${glow.y}px, rgba(255,255,255,0.09), transparent 70%)`,
        }}
      />
      <span
        aria-hidden
        className="absolute bottom-0.5 top-0.5 rounded-full"
        style={{
          left: rect.left,
          width: rect.width,
          background: face,
          boxShadow: "0 1px 0 rgba(255,255,255,0.55) inset, 0 1px 3px rgba(0,0,0,0.45)",
          transition: `left ${transition}, width ${transition}`,
          opacity: rect.ready ? 1 : 0,
        }}
      />
      <div className="relative z-[1] inline-flex items-center">{labels(false)}</div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[2] inline-flex items-center p-0.5"
        style={{
          background: face,
          clipPath: `inset(2px ${clipRight}px 2px ${rect.left}px round 999px)`,
          transition: `clip-path ${transition}`,
          opacity: rect.ready ? 1 : 0,
        }}
      >
        {labels(true)}
      </div>
    </div>
  );
}
