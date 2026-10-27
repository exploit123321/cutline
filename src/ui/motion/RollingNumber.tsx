/*
 * Ported from Peek & Grep (frontend/src/components/motion/RollingNumber.tsx, MIT, same author).
 * Digits roll on a vertical strip when the value changes (R29 Countdown). `text` lets a
 * caller roll a formatted value such as "0.000580" or "00:00:12:08".
 */

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

type Props = { value?: number; text?: string; className?: string };

export function RollingNumber({ value = 0, text, className }: Props) {
  const shown = text ?? Math.max(0, Math.round(value)).toLocaleString("en-US");
  const chars = shown.split("");
  return (
    <span className={`num inline-flex leading-[1.2em] ${className ?? ""}`} aria-label={shown}>
      {chars.map((ch, i) => {
        // keyed from the right so units stay in place when the number grows
        const key = chars.length - i;
        if (!/\d/.test(ch)) {
          return (
            <span key={`s${key}`} aria-hidden>
              {ch}
            </span>
          );
        }
        return (
          <span key={`d${key}`} className="roll-digit" aria-hidden>
            <span className="roll-strip" style={{ transform: `translateY(-${Number(ch) * 1.2}em)` }}>
              {DIGITS.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
