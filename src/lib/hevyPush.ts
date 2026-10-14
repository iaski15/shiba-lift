// Shiba Lift -> Hevy: finished workouts are posted to the user's Hevy account (so Hevy friends see them).
// Each local exercise is mapped once to a Hevy exercise template (matched by name, else created as a custom one).
import type { SQLiteDatabase } from 'expo-sqlite';
import { getKv, setKv } from './db';
import { hevyReq } from './hevy';

export type Template = { id: string; title: string };
export type PushRow = {
  exercise_id: string; name: string; muscle: string; equipment: string; hevy_template: string | null;
  weight: number; reps: number; warmup: number; superset: number | null;
};

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).sort().join(' ');

// Exact title first, then same words in any order ("Barbell Squat" = "Squat (Barbell)"). Only an unambiguous hit counts.
export function matchTemplate(name: string, templates: Template[]): string | null {
  const exact = templates.filter(t => t.title.toLowerCase() === name.toLowerCase());
  if (exact.length) return exact[0].id;
  const w = words(name);
  const loose = templates.filter(t => words(t.title) === w);
  return loose.length === 1 ? loose[0].id : null;
}

const MUSCLES = ['abdominals', 'shoulders', 'biceps', 'triceps', 'forearms', 'quadriceps', 'hamstrings', 'calves', 'glutes',
  'abductors', 'adductors', 'lats', 'upper_back', 'traps', 'lower_back', 'chest', 'cardio', 'neck', 'full_body', 'other'];
export const toHevyMuscle = (m: string) => {
  const k = m.toLowerCase().trim().replace(/ /g, '_');
  return MUSCLES.includes(k) ? k : ({ middle_back: 'upper_back', abs: 'abdominals', quads: 'quadriceps' } as Record<string, string>)[k] ?? 'other';
};
export const toHevyEquipment = (e: string) => {
  const k = e.toLowerCase().trim();
  if (/barbell|e-z|ez bar|smith/.test(k)) return 'barbell';
  if (/dumbbell/.test(k)) return 'dumbbell';
  if (/kettlebell/.test(k)) return 'kettlebell';
  if (/machine/.test(k)) return 'machine';
  if (/plate/.test(k)) return 'plate';
  if (/band/.test(k)) return 'resistance_band';
  if (/suspension|trx/.test(k)) return 'suspension';
  if (/body ?only|bodyweight|^none$/.test(k)) return 'none';
  return 'other';
};

// Rows are in save order; a new Hevy exercise starts whenever the exercise changes (same lift twice = two entries).
export function buildHevyWorkout(w: { name: string; started_at: number; ended_at: number }, rows: PushRow[], templateOf: (exId: string) => string) {
  const exercises: { exercise_template_id: string; superset_id: number | null; sets: object[] }[] = [];
  let prev: string | null = null;
  for (const r of rows) {
    if (r.exercise_id !== prev) exercises.push({ exercise_template_id: templateOf(r.exercise_id), superset_id: r.superset ?? null, sets: [] });
    prev = r.exercise_id;
    exercises[exercises.length - 1].sets.push({ type: r.warmup ? 'warmup' : 'normal', weight_kg: r.weight, reps: r.reps });
  }
  return {
    workout: {
      title: w.name || 'Workout',
      description: 'Logged with Shiba Lift 🐕',
      start_time: new Date(w.started_at).toISOString(),
      end_time: new Date(Math.max(w.ended_at, w.started_at + 60_000)).toISOString(),
      is_private: false,
      exercises,
    },
  };
}

// ---- queue: finished workouts waiting to be posted (survives being offline / app restarts) ----
const QUEUE = 'hevy_push_queue';
export const pushEnabled = async (db: SQLiteDatabase) => (await getKv(db, 'hevy_push')) === '1';
export const setPushEnabled = (db: SQLiteDatabase, on: boolean) => setKv(db, 'hevy_push', on ? '1' : null);
const readQueue = async (db: SQLiteDatabase): Promise<number[]> => JSON.parse((await getKv(db, QUEUE)) ?? '[]');
export async function enqueuePush(db: SQLiteDatabase, workoutId: number) {
  const q = await readQueue(db);
  if (!q.includes(workoutId)) await setKv(db, QUEUE, JSON.stringify([...q, workoutId]));
}

async function allTemplates(key: string): Promise<Template[]> {
  const out: Template[] = [];
  for (let page = 1, pages = 1; page <= pages; page++) {
    const r = await hevyReq<{ page_count?: number; exercise_templates?: Template[] }>('GET', `/exercise_templates?page=${page}&pageSize=100`, key);
    pages = r.page_count || 1;
    out.push(...(r.exercise_templates ?? []));
  }
  return out;
}

// Posts every queued workout. Returns how many went up; a failure stops the run and leaves the rest queued.
export async function pushPending(db: SQLiteDatabase, key: string, onProgress?: (m: string) => void) {
  const queue = await readQueue(db);
  let posted = 0;
  let templates: Template[] | null = null;
  try {
    for (const id of queue) {
      const w = await db.getFirstAsync<{ name: string; started_at: number; ended_at: number; hevy_id: string | null }>(
        'SELECT name, started_at, ended_at, hevy_id FROM workouts WHERE id = ?', id);
      if (w && !w.hevy_id) {
        onProgress?.(`Posting to Hevy… ${posted + 1}/${queue.length}`);
        const rows = await db.getAllAsync<PushRow>(`SELECT s.exercise_id, e.name, e.muscle, e.equipment, e.hevy_template,
          s.weight, s.reps, s.warmup, s.superset FROM sets s JOIN exercises e ON e.id = s.exercise_id WHERE s.workout_id = ? ORDER BY s.id`, id);
        const tpl = new Map<string, string>();
        for (const r of rows) {
          if (tpl.has(r.exercise_id)) continue;
          let t = r.hevy_template ?? matchTemplate(r.name, (templates ??= await allTemplates(key)));
          if (!t) { // no Hevy equivalent: create it as a custom exercise with the same name
            const bodyweight = rows.every(o => o.exercise_id !== r.exercise_id || !o.weight);
            const c = await hevyReq<{ id?: string | number; exercise_template?: { id: string } }>('POST', '/exercise_templates', key, {
              exercise: { title: r.name, exercise_type: bodyweight ? 'reps_only' : 'weight_reps', equipment_category: toHevyEquipment(r.equipment), muscle_group: toHevyMuscle(r.muscle), other_muscles: [] },
            });
            t = String(c.id ?? c.exercise_template?.id);
            (templates ??= []).push({ id: t, title: r.name });
          }
          tpl.set(r.exercise_id, t);
          await db.runAsync('UPDATE exercises SET hevy_template = ? WHERE id = ?', t, r.exercise_id);
        }
        const res = await hevyReq<{ workout?: { id: string }[] | { id: string }; id?: string }>('POST', '/workouts', key,
          buildHevyWorkout(w, rows, ex => tpl.get(ex)!));
        const hevyId = Array.isArray(res.workout) ? res.workout[0]?.id : res.workout?.id ?? res.id;
        // Linking it means the next sync sees this as the same workout instead of importing a duplicate.
        if (hevyId) await db.runAsync('UPDATE workouts SET hevy_id = ? WHERE id = ?', hevyId, id);
        posted++;
      }
      await setKv(db, QUEUE, JSON.stringify((await readQueue(db)).filter(x => x !== id)));
    }
  } catch (e) {
    // A stale cached template (e.g. deleted in Hevy) makes the post fail: forget mappings so the retry re-matches.
    if (e instanceof Error && /\b400\b/.test(e.message)) await db.runAsync('UPDATE exercises SET hevy_template = NULL');
    throw Object.assign(e instanceof Error ? e : new Error(String(e)), { posted });
  }
  return { posted, waiting: (await readQueue(db)).length };
}
