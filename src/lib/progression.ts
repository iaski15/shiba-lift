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

// Epley
export const e1rm = ({ weight, reps }: S) => (reps <= 1 ? weight : weight * (1 + reps / 30));

// First time doing an exercise is not a PR (otherwise every new exercise spams the popup).
export function isPR(set: S, history: S[]): PR | null {
  if (!history.length || set.reps <= 0) return null;
  if (set.weight > Math.max(...history.map(h => h.weight))) return 'weight';
  if (set.weight > 0 && e1rm(set) > Math.max(...history.map(e1rm)) + 1e-9) return 'e1rm';
  const atOrAbove = history.filter(h => h.weight >= set.weight);
  if (set.reps > Math.max(0, ...atOrAbove.map(h => h.reps))) return 'reps';
  return null;
}

export const prLabel: Record<PR, string> = {
  weight: 'Heaviest weight ever',
  e1rm: 'Best estimated 1RM',
  reps: 'Most reps at this weight',
};
