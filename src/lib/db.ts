import type { SQLiteDatabase } from 'expo-sqlite';
import { suggest, type S } from './progression';

export type Exercise = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  custom: number;
  rep_min: number;
  rep_max: number;
  increment: number;
};
export type DraftSet = { weight: string; reps: string; done: boolean };
// linked = superset with the next block (rest only starts after the last exercise of the superset).
export type Block = { ex: Exercise; prev: S[]; sugg: S[]; sets: DraftSet[]; linked?: boolean };
export type Draft = { name: string; startedAt: number; blocks: Block[]; prs?: number; routineId?: number; restEnd?: number };

export async function migrate(db: SQLiteDatabase) {
  const { user_version } = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!;
  if (user_version < 1) await v1(db);
  if (user_version < 2) {
    await db.execAsync(`
      CREATE TABLE routines (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, items TEXT NOT NULL);
      CREATE INDEX workouts_started ON workouts(started_at);
    `);
  }
  if (user_version < 3) {
    await db.execAsync(`
      ALTER TABLE workouts ADD COLUMN hevy_id TEXT;
      CREATE UNIQUE INDEX workouts_hevy ON workouts(hevy_id);
    `);
  }
  await db.execAsync('PRAGMA user_version = 3');
}

async function v1(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE exercises (id TEXT PRIMARY KEY, name TEXT NOT NULL, muscle TEXT, equipment TEXT,
      custom INTEGER DEFAULT 0, rep_min INTEGER DEFAULT 8, rep_max INTEGER DEFAULT 12, increment REAL DEFAULT 2.5);
    CREATE TABLE workouts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, started_at INTEGER, ended_at INTEGER);
    CREATE TABLE sets (id INTEGER PRIMARY KEY AUTOINCREMENT, workout_id INTEGER REFERENCES workouts(id) ON DELETE CASCADE,
      exercise_id TEXT, idx INTEGER, weight REAL, reps INTEGER);
    CREATE INDEX sets_ex ON sets(exercise_id, workout_id);
    CREATE TABLE kv (k TEXT PRIMARY KEY, v TEXT);
  `);
  const lib: { id: string; name: string; muscle: string; equipment: string }[] = require('../../assets/exercises.json');
  await db.withTransactionAsync(async () => {
    const st = await db.prepareAsync('INSERT INTO exercises (id, name, muscle, equipment) VALUES (?, ?, ?, ?)');
    try {
      for (const e of lib) await st.executeAsync(e.id, e.name, e.muscle, e.equipment);
    } finally {
      await st.finalizeAsync();
    }
  });
}

export const getExercises = (db: SQLiteDatabase) =>
  db.getAllAsync<Exercise>('SELECT * FROM exercises ORDER BY custom DESC, name');

export const saveExercise = (db: SQLiteDatabase, e: Exercise) =>
  db.runAsync(
    'REPLACE INTO exercises (id, name, muscle, equipment, custom, rep_min, rep_max, increment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    e.id, e.name, e.muscle, e.equipment, e.custom, e.rep_min, e.rep_max, e.increment,
  );

// Sets from the most recent workout (by date, so older imported workouts don't win) that had this exercise.
export const lastSets = (db: SQLiteDatabase, exId: string) =>
  db.getAllAsync<S>(
    `SELECT weight, reps FROM sets WHERE exercise_id = ? AND workout_id = (
      SELECT s.workout_id FROM sets s JOIN workouts w ON w.id = s.workout_id WHERE s.exercise_id = ? ORDER BY w.started_at DESC LIMIT 1
    ) ORDER BY idx`,
    exId, exId,
  );

export const history = (db: SQLiteDatabase, exId: string) =>
  db.getAllAsync<S>('SELECT weight, reps FROM sets WHERE exercise_id = ?', exId);

export async function makeBlock(db: SQLiteDatabase, ex: Exercise, sets?: number, linked?: boolean): Promise<Block> {
  const prev = await lastSets(db, ex.id);
  const n = sets || prev.length || 3;
  return { ex, prev, sugg: suggest(prev, ex), linked, sets: Array.from({ length: n }, () => ({ weight: '', reps: '', done: false })) };
}

export async function saveWorkout(db: SQLiteDatabase, d: Draft) {
  let id = 0;
  await db.withTransactionAsync(async () => {
    id = (await db.runAsync('INSERT INTO workouts (name, started_at, ended_at) VALUES (?, ?, ?)', d.name, d.startedAt, Date.now()))
      .lastInsertRowId;
    for (const b of d.blocks) {
      let idx = 0;
      for (const s of b.sets.filter(s => s.done)) {
        await db.runAsync('INSERT INTO sets (workout_id, exercise_id, idx, weight, reps) VALUES (?, ?, ?, ?, ?)',
          id, b.ex.id, idx++, Number(s.weight), Number(s.reps));
      }
    }
  });
  return id;
}

export type WorkoutRow = { id: number; name: string; started_at: number; ended_at: number; sets: number; volume: number };
export const listWorkouts = (db: SQLiteDatabase) =>
  db.getAllAsync<WorkoutRow>(`SELECT w.*, COUNT(s.id) AS sets, COALESCE(SUM(s.weight * s.reps), 0) AS volume
    FROM workouts w LEFT JOIN sets s ON s.workout_id = w.id GROUP BY w.id ORDER BY w.started_at DESC LIMIT 50`);

export const totals = async (db: SQLiteDatabase) =>
  (await db.getFirstAsync<{ workouts: number; volume: number }>(
    'SELECT (SELECT COUNT(*) FROM workouts) AS workouts, COALESCE((SELECT SUM(weight * reps) FROM sets), 0) AS volume',
  ))!;

export const workoutExercises = (db: SQLiteDatabase, workoutId: number) =>
  db.getAllAsync<Exercise>(`SELECT e.* FROM sets s JOIN exercises e ON e.id = s.exercise_id
    WHERE s.workout_id = ? GROUP BY e.id ORDER BY MIN(s.id)`, workoutId);

export type PRRow = { name: string; weight: number; best: number };
export const personalRecords = (db: SQLiteDatabase) =>
  db.getAllAsync<PRRow>(`SELECT e.name, MAX(s.weight) AS weight,
    MAX(CASE WHEN s.reps <= 1 THEN s.weight ELSE s.weight * (1 + s.reps / 30.0) END) AS best
    FROM sets s JOIN exercises e ON e.id = s.exercise_id GROUP BY e.id ORDER BY best DESC`);

// In-progress workout survives app kills.
export const getDraft = async (db: SQLiteDatabase) => {
  const row = await db.getFirstAsync<{ v: string }>("SELECT v FROM kv WHERE k = 'draft'");
  return row ? (JSON.parse(row.v) as Draft) : null;
};
export const setDraft = (db: SQLiteDatabase, d: Draft | null) =>
  d ? db.runAsync("REPLACE INTO kv (k, v) VALUES ('draft', ?)", JSON.stringify(d)) : db.runAsync("DELETE FROM kv WHERE k = 'draft'");

// Routines (e.g. Push / Pull / Legs). Name is stored for display; id is what links to history.
export type RoutineItem = { id: string; name: string; sets: number; linked?: boolean };
export type Routine = { id?: number; name: string; items: RoutineItem[] };

export const listRoutines = async (db: SQLiteDatabase) =>
  (await db.getAllAsync<{ id: number; name: string; items: string }>('SELECT * FROM routines ORDER BY id'))
    .map(r => ({ ...r, items: JSON.parse(r.items) as RoutineItem[] }));

export const getRoutine = async (db: SQLiteDatabase, id: number) => (await listRoutines(db)).find(r => r.id === id) ?? null;

export const saveRoutine = async (db: SQLiteDatabase, r: Routine) =>
  r.id
    ? (await db.runAsync('UPDATE routines SET name = ?, items = ? WHERE id = ?', r.name, JSON.stringify(r.items), r.id), r.id)
    : (await db.runAsync('INSERT INTO routines (name, items) VALUES (?, ?)', r.name, JSON.stringify(r.items))).lastInsertRowId;

export const deleteRoutine = (db: SQLiteDatabase, id: number) => db.runAsync('DELETE FROM routines WHERE id = ?', id);

export async function routineBlocks(db: SQLiteDatabase, r: Routine) {
  const blocks: Block[] = [];
  for (const it of r.items) {
    const ex = await db.getFirstAsync<Exercise>('SELECT * FROM exercises WHERE id = ?', it.id);
    if (ex) blocks.push(await makeBlock(db, ex, it.sets, it.linked));
  }
  return blocks;
}

// Imported exercise names that aren't in the library become custom exercises ("Bench Press (Barbell)" -> equipment barbell).
export async function importWorkouts(db: SQLiteDatabase, ws: import('./csv').ImportedWorkout[]) {
  const res = { workouts: 0, sets: 0, skipped: 0, newExercises: 0 };
  const byName = new Map((await getExercises(db)).map(e => [e.name.toLowerCase(), e.id]));
  const seen = new Set((await db.getAllAsync<{ started_at: number }>('SELECT started_at FROM workouts')).map(r => r.started_at));
  // Hundreds of workouts are 10k+ set rows: prepared statements + 150-row multi-inserts (750 params, under SQLite's 999).
  const BATCH = 150;
  const insW = await db.prepareAsync('INSERT INTO workouts (name, started_at, ended_at, hevy_id) VALUES (?, ?, ?, ?)');
  const insE = await db.prepareAsync('INSERT OR IGNORE INTO exercises (id, name, muscle, equipment, custom) VALUES (?, ?, ?, ?, 1)');
  const insS = await db.prepareAsync(`INSERT INTO sets (workout_id, exercise_id, idx, weight, reps) VALUES ${Array(BATCH).fill('(?, ?, ?, ?, ?)').join(', ')}`);
  let buf: (string | number)[] = [];
  const flush = async (all = false) => {
    while (buf.length >= BATCH * 5) { await insS.executeAsync(buf.slice(0, BATCH * 5)); buf = buf.slice(BATCH * 5); }
    for (let i = 0; all && i < buf.length; i += 5) {
      await db.runAsync('INSERT INTO sets (workout_id, exercise_id, idx, weight, reps) VALUES (?, ?, ?, ?, ?)', buf.slice(i, i + 5));
    }
    if (all) buf = [];
  };
  try {
    await db.withTransactionAsync(async () => {
      for (const w of ws) {
        if (w.hevyId) {
          // Synced from Hevy: replace the old copy (same Hevy id, or the CSV-imported one with the same start time).
          await flush(true);
          await removeWorkouts(db, 'hevy_id = ? OR (hevy_id IS NULL AND started_at = ?)', [w.hevyId, w.start]);
        } else if (seen.has(w.start)) { res.skipped++; continue; } // re-importing the same export is a no-op
        seen.add(w.start);
        const wid = (await insW.executeAsync(w.name, w.start, w.end, w.hevyId ?? null)).lastInsertRowId;
        const idx = new Map<string, number>();
        for (const st of w.sets) {
          let exId = byName.get(st.exercise.toLowerCase());
          if (!exId) {
            exId = `custom-import-${st.exercise.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            const equipment = st.exercise.match(/\(([^)]+)\)\s*$/)?.[1].toLowerCase() ?? 'other';
            await insE.executeAsync(exId, st.exercise, 'other', equipment);
            byName.set(st.exercise.toLowerCase(), exId);
            res.newExercises++;
          }
          const i = idx.get(exId) ?? 0;
          idx.set(exId, i + 1);
          buf.push(wid, exId, i, st.weight, st.reps);
          res.sets++;
        }
        res.workouts++;
        await flush();
      }
      await flush(true);
    });
  } finally {
    await Promise.all([insW.finalizeAsync(), insE.finalizeAsync(), insS.finalizeAsync()]);
  }
  return res;
}

const removeWorkouts = async (db: SQLiteDatabase, where: string, params: (string | number)[]) => {
  await db.runAsync(`DELETE FROM sets WHERE workout_id IN (SELECT id FROM workouts WHERE ${where})`, params);
  await db.runAsync(`DELETE FROM workouts WHERE ${where}`, params);
};

export async function deleteHevyWorkouts(db: SQLiteDatabase, hevyIds: string[]) {
  await db.withTransactionAsync(async () => {
    for (const id of hevyIds) await removeWorkouts(db, 'hevy_id = ?', [id]);
  });
}

export const getKv = async (db: SQLiteDatabase, k: string) => (await db.getFirstAsync<{ v: string }>('SELECT v FROM kv WHERE k = ?', k))?.v ?? null;
export const setKv = (db: SQLiteDatabase, k: string, v: string | null) =>
  v === null ? db.runAsync('DELETE FROM kv WHERE k = ?', k) : db.runAsync('REPLACE INTO kv (k, v) VALUES (?, ?)', k, v);
