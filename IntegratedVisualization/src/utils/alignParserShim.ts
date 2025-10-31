// Lightweight shim for @linkview/linkview-align-parser to unblock runtime
// Provides minimal implementations used by linkview-core's svg and align creators

export const DEFAULT_COLOR_FLAG = '__DEFAULT_COLOR__';
export const DEFAULT_OPACITY_FLAG = '__DEFAULT_OPACITY__';

export type Alignment = {
  ctg1: string;
  start1: number;
  end1: number;
  ctg2: string;
  start2: number;
  end2: number;
  color?: string;
  opacity?: number;
};

export type ParseResult = {
  alignments: Alignment[];
  lenInfo: Record<string, number>;
  alignmentsByCtgs: Record<string, Record<string, Alignment[]>>;
};

// Intersection helper used by highlightSvg
export function intersection(a: [number, number], b: [number, number]): [number, number] {
  const aMin = Math.min(a[0], a[1]);
  const aMax = Math.max(a[0], a[1]);
  const bMin = Math.min(b[0], b[1]);
  const bMax = Math.max(b[0], b[1]);
  const start = Math.max(aMin, bMin);
  const end = Math.min(aMax, bMax);
  return [start, end];
}

// Error pointer used by highlightSvg when parsing ranges; keep simple
export function errorPos(line: string, parts: string[], offset = 0): string {
  const joined = parts.join(' ');
  const idx = Math.max(0, line.indexOf(joined) + offset);
  const caret = `${' '.repeat(idx)}^`;
  return `${line}\n${caret}`;
}

// Clip alignment to display ranges used by alignmentSvg
export function calculateSubAlign(
  alignment: Alignment,
  displayStart1: number,
  displayEnd1: number,
  displayStart2: number,
  displayEnd2: number
): Alignment | null {
  const min1 = Math.min(displayStart1, displayEnd1);
  const max1 = Math.max(displayStart1, displayEnd1);
  const min2 = Math.min(displayStart2, displayEnd2);
  const max2 = Math.max(displayStart2, displayEnd2);

  const [clipStart1, clipEnd1] = intersection([alignment.start1, alignment.end1], [min1, max1]);
  const [clipStart2, clipEnd2] = intersection([alignment.start2, alignment.end2], [min2, max2]);

  if (clipStart1 > clipEnd1 || clipStart2 > clipEnd2) return null;

  return {
    ...alignment,
    start1: clipStart1,
    end1: clipEnd1,
    start2: clipStart2,
    end2: clipEnd2,
  };
}

// Parse content lines; expected format:
// ctg1 start1 end1 ctg2 start2 end2 [color] [opacity]
export function alignParserFromContent(content: string): ParseResult {
  const alignments: Alignment[] = [];
  const lenInfo: Record<string, number> = {};
  const alignmentsByCtgs: Record<string, Record<string, Alignment[]>> = {};

  if (!content) return { alignments, lenInfo, alignmentsByCtgs };

  const lines = content.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 6) continue;
    const [ctg1, s1, e1, ctg2, s2, e2, colorMaybe, opacityMaybe] = parts;
    const start1 = parseInt(s1, 10);
    const end1 = parseInt(e1, 10);
    const start2 = parseInt(s2, 10);
    const end2 = parseInt(e2, 10);
    if ([start1, end1, start2, end2].some(n => Number.isNaN(n))) continue;
    const color = colorMaybe ?? DEFAULT_COLOR_FLAG;
    const opacity = opacityMaybe ? Number(opacityMaybe) : undefined;
    const aln: Alignment = { ctg1, start1, end1, ctg2, start2, end2, color, opacity };
    alignments.push(aln);
    lenInfo[ctg1] = Math.max(lenInfo[ctg1] || 0, Math.max(start1, end1));
    lenInfo[ctg2] = Math.max(lenInfo[ctg2] || 0, Math.max(start2, end2));
    if (!(ctg1 in alignmentsByCtgs)) alignmentsByCtgs[ctg1] = {};
    if (!(ctg2 in alignmentsByCtgs[ctg1])) alignmentsByCtgs[ctg1][ctg2] = [];
    alignmentsByCtgs[ctg1][ctg2].push(aln);
    if (!(ctg2 in alignmentsByCtgs)) alignmentsByCtgs[ctg2] = {};
    if (!(ctg1 in alignmentsByCtgs[ctg2])) alignmentsByCtgs[ctg2][ctg1] = [];
    alignmentsByCtgs[ctg2][ctg1].push(aln);
  }

  return { alignments, lenInfo, alignmentsByCtgs };
}

// Default parser: for browser usage prefer content-based; for Node path input, try reading
export default function alignParser(input: string): ParseResult {
  // Browser-safe: do not attempt Node fs; only parse provided content
  if (typeof input === 'string' && (input.includes('\n') || input.includes(' '))) {
    return alignParserFromContent(input);
  }
  return { alignments: [], lenInfo: {}, alignmentsByCtgs: {} };
}