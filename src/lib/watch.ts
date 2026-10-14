import { num, type Draft, type Routine } from './db';

// What the watch app sends (modules/shiba-wear carries it; the watch code is in wear/). `id` = watch time in ms,
// strictly increasing, so it orders the taps and the phone can say "handled up to here" (ack).
// Sets are addressed by position plus exercise id, so a tap aimed at a set that has since moved is ignored.
export type WatchAction = { id: number } & (
  | { type: 'set'; bi: number; si: number; ex: string; w: number; r: number }
  | { type: 'undo'; bi: number; si: number; ex: string }
  | { type: 'rest'; add: number } // add 0 = skip the rest
  | { type: 'start'; routineId?: number }
  | { type: 'finish' }
);

const START_MAX_AGE = 2 * 60_000; // a "start" tapped while the phone app was closed shouldn't start a workout hours later

export function newActions(raw: string[], ack: number, now: number): WatchAction[] {
  return raw.map(j => JSON.parse(j) as WatchAction)
    .filter(a => a.id > ack && !(a.type === 'start' && now - a.id > START_MAX_AGE))
    .sort((a, b) => a.id - b.id);
}

// The watch shows each set's typed value, else Shiba's suggestion, else the set before it.
export function watchState(d: Draft | null, routines: Routine[], ack: number) {
  return JSON.stringify({
    ack,
    routines: routines.map(r => ({ id: r.id, name: r.name })),
    workout: d && {
      name: d.name, startedAt: d.startedAt, restEnd: d.restEnd ?? 0,
      blocks: d.blocks.map(b => {
        let w = 0, r = b.ex.rep_min;
        return {
          ex: b.ex.id, name: b.ex.name, inc: b.ex.increment, linked: !!b.linked,
          sets: b.sets.map((s, si) => {
            const sg = b.sugg[si] ?? b.sugg[b.sugg.length - 1];
            w = num(s.weight) ?? sg?.weight ?? w;
            r = num(s.reps) ?? sg?.reps ?? r;
            return { w, r, done: s.done, warmup: !!s.warmup };
          }),
        };
      }),
    },
  });
}
