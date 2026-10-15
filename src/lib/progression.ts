export type S = { weight: number; reps: number };
export type Range = { rep_min: number; rep_max: number; increment: number };
export type PR = 'weight' | 'e1rm' | 'reps';

const round = (n: number) => Math.round(n * 100) / 100;

// Double progression on the top-weight sets: hit rep_max on every one -> add weight, back to rep_min.
// Otherwise same weight, +1 rep per set (capped). Lighter sets (warmups) are kept as they were.
// `deload` (see `stalled`): top sets drop ~10%, rounded to the increment, same reps, and build back up from there.
export function suggest(last: S[], r: Range, deload = false): S[] {
  if (!last.length) return [];
  const top = Math.max(...last.map(s => s.weight));
  const working = last.filter(s => s.weight === top);
  const light = deloadWeight(top, r.increment);
  if (deload && light > 0) return last.map(s => (s.weight === top ? { weight: light, reps: s.reps } : s));
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

// One exercise in one workout, working sets only: heaviest weight and total reps done at it.
export type Session = { workout_id: number; exercise_id: string; top: number; reps: number };
export const sessionKey = (s: { workout_id: number; exercise_id: string }) => `${s.workout_id}:${s.exercise_id}`;

// Sessions oldest first. Beat last time = heavier top weight, or the same top weight for more total reps.
// `up` = keys of sessions that beat the previous one of that exercise. A workout extends the streak if any exercise
// went up and breaks it if none did; a workout of only new exercises has nothing to compare, so it does neither.
export function overload(sessions: Session[]) {
  const last = new Map<string, Session>(), up = new Set<string>(), byWorkout = new Map<number, boolean>();
  for (const s of sessions) {
    const p = last.get(s.exercise_id);
    if (p) {
      const beat = s.top > p.top || (s.top === p.top && s.reps > p.reps);
      if (beat) up.add(sessionKey(s));
      byWorkout.set(s.workout_id, (byWorkout.get(s.workout_id) ?? false) || beat);
    }
    last.set(s.exercise_id, s);
  }
  let current = 0, best = 0;
  for (const beat of byWorkout.values()) { current = beat ? current + 1 : 0; best = Math.max(best, current); }
  return { up, byWorkout, current, best };
}

// Stalled = the last 3 sessions all at the same top weight, and neither of the later two got more total reps than the first.
// Once deloaded the top weight changes, so it can't fire again until you're stuck at a new weight.
export function stalled(sessions: Session[]) {
  const l = sessions.slice(-3);
  return l.length === 3 && l[0].top > 0 && l.every(s => s.top === l[0].top) && l[1].reps <= l[0].reps && l[2].reps <= l[0].reps;
}
export const deloadWeight = (top: number, inc: number) => Math.max(0, Math.min(top - inc, round(Math.round((top * 0.9) / inc) * inc)));

// Plates per side of the bar, heaviest first. `rest` = weight that can't be made with these plates (per side).
// ponytail: fixed 20 kg bar and standard kg plates; add a setting if someone has a 15 kg bar or lb plates.
export const BAR = 20;
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
export function plates(total: number, bar = BAR) {
  let side = round((total - bar) / 2);
  const out: number[] = [];
  if (side < 0) return { plates: out, rest: 0, underBar: true };
  for (const p of PLATES) while (side >= p - 1e-9) { out.push(p); side = round(side - p); }
  return { plates: out, rest: side, underBar: false };
}

export const DEFAULT_RANGE: Range ={ rep_min: 8, rep_max: 12, increment: 2.5 };

// Text fields -> Range, or an error message to show.
export function parseRange(f: { rep_min: string; rep_max: string; increment: string }): Range | string {
  const rep_min = Number(f.rep_min), rep_max = Number(f.rep_max), increment = Number(f.increment.replace(',', '.'));
  if (!Number.isInteger(rep_max) || rep_max < 1 || rep_max > 100) return 'Reps to move up must be a whole number from 1 to 100.';
  if (!Number.isInteger(rep_min) || rep_min < 1 || rep_min > rep_max) return `Reps to start again at must be a whole number from 1 to ${rep_max}.`;
  if (!Number.isFinite(increment) || increment <= 0 || increment > 100) return 'Weight to add must be more than 0 kg (e.g. 2.5).';
  return { rep_min, rep_max, increment: Math.round(increment * 100) / 100 };
}
