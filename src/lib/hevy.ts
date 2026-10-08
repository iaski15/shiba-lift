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
      e.sets.filter(s => (s.reps ?? 0) > 0).map(s => ({ exercise: e.title.trim(), weight: Math.round((s.weight_kg ?? 0) * 100) / 100, reps: Math.round(s.reps!) })),
    ),
  };
}

// Pulls every workout created/edited/deleted in Hevy since the last sync (first sync = everything).
export async function syncHevy(db: SQLiteDatabase, key: string, onProgress?: (msg: string) => void) {
  const startedAt = new Date();
  const since = (await getKv(db, 'hevy_since')) ?? '1970-01-01T00:00:00Z';
  const updated: ImportedWorkout[] = [];
  const deleted: string[] = [];
  for (let page = 1, pages = 1; page <= pages; page++) {
    onProgress?.(`Fetching from Hevy… ${page}/${pages}`);
    const r = await hevyGet<{ page_count: number; events: HevyEvent[] }>(`/workouts/events?page=${page}&pageSize=10&since=${encodeURIComponent(since)}`, key);
    pages = r.page_count || 1;
    for (const e of r.events) {
      if (e.type === 'deleted') deleted.push(e.id);
      else if (Number.isFinite(Date.parse(e.workout.start_time))) updated.push(toImported(e.workout));
    }
  }
  onProgress?.('Saving…');
  updated.sort((a, b) => a.start - b.start);
  const res = await importWorkouts(db, updated);
  if (deleted.length) await deleteHevyWorkouts(db, deleted);
  // A minute of overlap so edits made while we were fetching aren't missed (re-applying is harmless).
  await setKv(db, 'hevy_since', new Date(startedAt.getTime() - 60_000).toISOString());
  return { workouts: res.workouts, sets: res.sets, deleted: deleted.length, newExercises: res.newExercises };
}
