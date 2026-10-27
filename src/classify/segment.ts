/**
 * Split a pasted rundown into segments: one per line, with bracketed cues pulled out
 * into their own segment and a line split again where a new "NAME:" prefix starts
 * after the end of a sentence.
 */
export function segment(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    for (const part of line.split(/(\[[^\]]*\])/)) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("[")) {
        out.push(trimmed);
        continue;
      }
      for (const sentence of trimmed.split(/(?<=[.!?])\s+(?=\p{Lu}[\p{L}.]*\s*:)/u)) {
        const s = sentence.trim();
        if (s) out.push(s);
      }
    }
  }
  return out;
}
