/** [time, pitch] in group-relative blicks and absolute semitones. */
export type PitchSample = [Blick, number];

export interface TimeRange {
  start: Blick;
  end: Blick;
}

export interface CurveSplit {
  /** Parts of the curve that fall inside the ranges and become pitch points. */
  converted: TimeRange[];
  /** Parts of the curve outside the ranges, kept as pitch lines (each has 2+ samples). */
  remainders: PitchSample[][];
}

/** Sorts ranges and merges overlapping or touching ones. */
export function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  const sorted = ranges
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);
  const merged: TimeRange[] = [];
  sorted.forEach((range) => {
    const last = merged[merged.length - 1];
    if (last !== undefined && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ start: range.start, end: range.end });
    }
  });
  return merged;
}

/** Linear interpolation over time-sorted samples, clamped to the first and last sample. */
export function interpolatePitch(samples: PitchSample[], time: Blick): number {
  if (time <= samples[0][0]) {
    return samples[0][1];
  }
  for (let i = 1; i < samples.length; i++) {
    const [t1, p1] = samples[i];
    if (time <= t1) {
      const [t0, p0] = samples[i - 1];
      return t1 === t0 ? p1 : p0 + ((p1 - p0) * (time - t0)) / (t1 - t0);
    }
  }
  return samples[samples.length - 1][1];
}

/** Splits a curve (time-sorted samples) into the parts inside and outside merged ranges. */
export function splitCurve(samples: PitchSample[], ranges: TimeRange[]): CurveSplit {
  if (samples.length < 2) {
    return { converted: [], remainders: [] };
  }
  const spanStart = samples[0][0];
  const spanEnd = samples[samples.length - 1][0];
  const converted: TimeRange[] = [];
  mergeRanges(ranges).forEach((range) => {
    const start = Math.max(range.start, spanStart);
    const end = Math.min(range.end, spanEnd);
    if (end > start) {
      converted.push({ start, end });
    }
  });

  const remainders: PitchSample[][] = [];
  const keep = (start: Blick, end: Blick) => {
    if (end <= start) {
      return;
    }
    const segment: PitchSample[] = [[start, interpolatePitch(samples, start)]];
    samples.forEach(([time, pitch]) => {
      if (time > start && time < end) {
        segment.push([time, pitch]);
      }
    });
    segment.push([end, interpolatePitch(samples, end)]);
    remainders.push(segment);
  };
  if (converted.length > 0) {
    let cursor = spanStart;
    converted.forEach((range) => {
      keep(cursor, range.start);
      cursor = range.end;
    });
    keep(cursor, spanEnd);
  }
  return { converted, remainders };
}

/**
 * Sample times from start to end every `intervalSeconds` of real time, always including `end`.
 * `toSeconds`/`toBlick` convert between group-relative blicks and seconds so tempo changes apply.
 */
export function sampleTimes(
  range: TimeRange,
  intervalSeconds: number,
  toSeconds: (time: Blick) => number,
  toBlick: (seconds: number) => Blick,
): Blick[] {
  const startSeconds = toSeconds(range.start);
  const endSeconds = toSeconds(range.end);
  const times: Blick[] = [range.start];
  const steps = Math.floor((endSeconds - startSeconds) / intervalSeconds + 1e-9);
  for (let i = 1; i <= steps; i++) {
    const time = Math.round(toBlick(startSeconds + i * intervalSeconds));
    if (time > times[times.length - 1] && time < range.end) {
      times.push(time);
    }
  }
  times.push(range.end);
  return times;
}
