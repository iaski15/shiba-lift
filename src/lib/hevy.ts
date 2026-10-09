// Hevy public API (Hevy Pro): https://api.hevyapp.com/docs — key from hevy.com/settings?developer.
// Workouts only; Hevy exposes no followers/friends endpoints.
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ImportedWorkout } from './csv';
import { deleteHevyWorkouts, getKv, importWorkouts, setKv } from './db';

const BASE = 'https://api.hevyapp.com/v1';

type HevySet = { type: string; weight_kg: number | null; reps: number | null };
type HevyWorkout = { id: string; title: string; start_time: string; end_time: string; exercises: { title: string; sets: HevySet[] }[] };
type HevyEvent = { type: 'updated'; workout: HevyWorkout } | { type: 'deleted'; id: string };
export type HevyUser = { username: string; name: string };

export async function hevyGet<T>(path: string, key: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { 'api-key': key, accept: 'application/json' } });
  if (res.status === 401 || res.status === 403) throw new Error('Hevy rejected the API key. Copy it again from hevy.com/settings?developer (needs Hevy Pro).');
  if (!res.ok) throw new Error(`Hevy API error ${res.status}. Try again in a bit.`);
  return res.json() as Promise<T>;
}

// Sets without reps (cardio / timed holds) are skipped, same as the CSV import.
export function toImported(w: HevyWorkout): ImportedWorkout {
  const start = Date.parse(w.start_time);
  const end = Date.parse(w.end_time);
  return {
    hevyId: w.id,
    name: w.title?.trim() || 'Workout',
    start,
    end: Number.isFinite(end) ? end : start,
    sets: w.exercises.flatMap(e =>
      e.sets.filter(s => (s.reps ?? 0) > 0).map(s => ({
        exercise: e.title.trim(), weight: Math.round((s.weight_kg ?? 0) * 100) / 100, reps: Math.round(s.reps!),
        ...(s.type === 'warmup' ? { warmup: true } : {}),
      })),
    ),
  };
}

// Pulls every workout created/edited/deleted in Hevy since the last sync (first sync = everything), then checks the
// total against Hevy's own count; if anything is missing it walks Hevy's full workout list (safe: matched by Hevy id).
export async function syncHevy(db: SQLiteDatabase, key: string, onProgress?: (msg: string) => void) {
  const startedAt = new Date();
  const since = (await getKv(db, 'hevy_since')) ?? '1970-01-01T00:00:00Z';
  const updated: ImportedWorkout[] = [];
  const deleted: string[] = [];
  for (let page = 1, pages = 1; page <= pages; page++) {
    onProgress?.(`Fetching changes… ${page}/${pages}`);
    const r = await hevyGet<{ page_count?: number; events?: HevyEvent[] }>(`/workouts/events?page=${page}&pageSize=10&since=${encodeURIComponent(since)}`, key);
    pages = r.page_count || 1;
    for (const e of r.events ?? []) { // no changes: Hevy leaves `events` out
      if (e.type === 'deleted') deleted.push(e.id);
      else if (Number.isFinite(Date.parse(e.workout.start_time))) updated.push(toImported(e.workout));
    }
  }

  onProgress?.('Saving…');
  updated.sort((a, b) => a.start - b.start);
  const res = await importWorkouts(db, updated);
  if (deleted.length) await deleteHevyWorkouts(db, deleted);

  const { workout_count: hevyTotal = 0 } = await hevyGet<{ workout_count?: number }>('/workouts/count', key);
  const localHevy = async () => (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM workouts WHERE hevy_id IS NOT NULL'))!.n;
  const before = await localHevy();
  let backfilled = 0;
  let listed: number | null = null;
  let badDate = 0;
  if (before < hevyTotal) {
    const all: ImportedWorkout[] = [];
    for (let page = 1, pages = 1; page <= pages; page++) {
      onProgress?.(`Fetching all workouts… ${page}/${pages}`);
      const r = await hevyGet<{ page_count?: number; workouts?: HevyWorkout[] }>(`/workouts?page=${page}&pageSize=10`, key);
      pages = r.page_count || 1;
      for (const w of r.workouts ?? []) {
        listed = (listed ?? 0) + 1;
        if (Number.isFinite(Date.parse(w.start_time))) all.push(toImported(w));
        else badDate++;
      }
    }
    onProgress?.('Saving…');
    res.newExercises += (await importWorkouts(db, all.sort((a, b) => a.start - b.start))).newExercises;
    backfilled = (await localHevy()) - before;
  }

  // A minute of overlap so edits made while we were fetching aren't missed (re-applying is harmless).
  await setKv(db, 'hevy_since', new Date(startedAt.getTime() - 60_000).toISOString());
  return { workouts: res.workouts, sets: res.sets, deleted: deleted.length, newExercises: res.newExercises, backfilled, hevyTotal, listed, badDate, synced: await localHevy() };
}
