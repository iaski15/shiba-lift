export type S = { weight: number; reps: number };
export type Range = { rep_min: number; rep_max: number; increment: number };
export type PR = 'weight' | 'e1rm' | 'reps';

const round = (n: number) => Math.round(n * 100) / 100;

// Double progression on the top-weight sets: hit rep_max on every one -> add weight, back to rep_min.
// Otherwise same weight, +1 rep per set (capped). Lighter sets (warmups) are kept as they were.
export function suggest(last: S[], r: Range): S[] {
  if (!last.length) return [];
  const top = Math.max(...last.map(s => s.weight));
  const working = last.filter(s => s.weight === top);
  if (working.every(s => s.reps >= r.rep_max)) {
    return last.map(s => (s.weight === top ? { weight: round(top + r.increment), reps: r.rep_min } : s));
  }
  return last.map(s => (s.weight === top ? { weight: top, reps: Math.min(r.rep_max, s.reps + 1) } : s));
}

// Estimated 1RM = average of the 7 standard formulas (Epley, Brzycki, Lander, Lombardi, Mayhew, O'Conner, Wathan).
// Each one is biased (Epley runs high, Brzycki low, as reps go up); the average is steadier than any single one.
// Only sets of 1-12 reps count: past ~12 reps every formula gets unreliable, so high-rep sets give no estimate (0).
export const E1RM_MAX_REPS = 12;
export function e1rm({ weight: w, reps: r }: S) {
  if (w <= 0 || r < 1 || r > E1RM_MAX_REPS) return 0;
  if (r === 1) return w;
  const est = [
    w * (1 + r / 30), // Epley
    (w * 36) / (37 - r), // Brzycki
    (100 * w) / (101.3 - 2.67123 * r), // Lander
    w * r ** 0.1, // Lombardi
    (100 * w) / (52.2 + 41.9 * Math.exp(-0.055 * r)), // Mayhew
    w * (1 + r / 40), // O'Conner
    (100 * w) / (48.8 + 53.8 * Math.exp(-0.075 * r)), // Wathan
  ];
  return est.reduce((a, b) => a + b) / est.length;
}

// First time doing an exercise is not a PR (otherwise every new exercise spams the popup).
export function isPR(set: S, history: S[]): PR | null {
  if (!history.length || set.reps <= 0) return null;
  if (set.weight > Math.max(...history.map(h => h.weight))) return 'weight';
  if (e1rm(set) > Math.max(0, ...history.map(e1rm)) + 1e-9) return 'e1rm';
  const atOrAbove = history.filter(h => h.weight >= set.weight);
  if (set.reps > Math.max(0, ...atOrAbove.map(h => h.reps))) return 'reps';
  return null;
}

export const prLabel: Record<PR, string> = {
  weight: 'Heaviest weight ever',
  e1rm: 'Best estimated 1RM',
  reps: 'Most reps at this weight',
};

export const DEFAULT_RANGE: Range = { rep_min: 8, rep_max: 12, increment: 2.5 };

// Text fields -> Range, or an error message to show.
export function parseRange(f: { rep_min: string; rep_max: string; increment: string }): Range | string {
  const rep_min = Number(f.rep_min), rep_max = Number(f.rep_max), increment = Number(f.increment.replace(',', '.'));
  if (!Number.isInteger(rep_max) || rep_max < 1 || rep_max > 100) return 'Reps to move up must be a whole number from 1 to 100.';
  if (!Number.isInteger(rep_min) || rep_min < 1 || rep_min > rep_max) return `Reps to start again at must be a whole number from 1 to ${rep_max}.`;
  if (!Number.isFinite(increment) || increment <= 0 || increment > 100) return 'Weight to add must be more than 0 kg (e.g. 2.5).';
  return { rep_min, rep_max, increment: Math.round(increment * 100) / 100 };
}
