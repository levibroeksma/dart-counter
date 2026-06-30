import type { Segment } from "./types";

const BOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export function boardNeighbors(base: number): number[] {
  return neighbors(base);
}

function neighbors(base: number): number[] {
  const idx = BOARD_ORDER.indexOf(base);
  if (idx === -1) return [];
  const prev = BOARD_ORDER[(idx - 1 + BOARD_ORDER.length) % BOARD_ORDER.length]!;
  const next = BOARD_ORDER[(idx + 1) % BOARD_ORDER.length]!;
  return [prev, next];
}

function makeSegment(
  label: string,
  score: number,
  ring: Segment["ring"],
  base: number,
  adjacent: Segment[],
): Segment {
  return { label, score, ring, base, adjacent };
}

const SEGMENT_CACHE = new Map<string, Segment>();

function buildSegment(label: string): Segment {
  const cached = SEGMENT_CACHE.get(label);
  if (cached) return cached;

  if (label === "25") {
    const seg = makeSegment("25", 25, "outer", 25, []);
    SEGMENT_CACHE.set(label, seg);
    return seg;
  }
  if (label === "50") {
    const seg = makeSegment("50", 50, "bull", 50, []);
    SEGMENT_CACHE.set(label, seg);
    return seg;
  }

  const match = label.match(/^(T|D)?(\d{1,2})$/);
  if (!match) throw new Error(`Invalid segment: ${label}`);

  const prefix = match[1] ?? "";
  const base = Number(match[2]);
  const ring: Segment["ring"] =
    prefix === "T" ? "triple" : prefix === "D" ? "double" : "single";
  const adjNums = neighbors(base);
  const score = prefix === "T" ? base * 3 : prefix === "D" ? base * 2 : base;

  const seg = makeSegment(label, score, ring, base, []);
  SEGMENT_CACHE.set(label, seg);

  const adjacent: Segment[] = [];

  if (ring === "triple") {
    adjacent.push(buildSegment(String(base)));
    for (const n of adjNums) adjacent.push(buildSegment(`T${n}`));
  } else if (ring === "double") {
    adjacent.push(buildSegment(String(base)));
    for (const n of adjNums) adjacent.push(buildSegment(`D${n}`));
  } else {
    adjacent.push(buildSegment(`D${base}`));
    for (const n of adjNums) adjacent.push(buildSegment(String(n)));
  }

  seg.adjacent.push(...adjacent);
  return seg;
}

export function parseSegment(label: string): Segment {
  if (label.startsWith("S") && label.length > 1) {
    return buildSegment(label.slice(1));
  }
  return buildSegment(label);
}

export function scoreForSegment(segment: Segment): number {
  return segment.score;
}
