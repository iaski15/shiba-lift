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
export type Block = { ex: Exercise; prev: S[]; sugg: S[]; sets: DraftSet[] };
export type Draft = { name: string; startedAt: number; blocks: Block[]; prs?: number };

export async function migrate(db: SQLiteDatabase) {
  const { user_version } = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!;
  if (user_version >= 1) return;
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
  await db.execAsync('PRAGMA user_version = 1');
}

export const getExercises = (db: SQLiteDatabase) =>
  db.getAllAsync<Exercise>('SELECT * FROM exercises ORDER BY custom DESC, name');

export const saveExercise = (db: SQLiteDatabase, e: Exercise) =>
  db.runAsync(
    'REPLACE INTO exercises (id, name, muscle, equipment, custom, rep_min, rep_max, increment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    e.id, e.name, e.muscle, e.equipment, e.custom, e.rep_min, e.rep_max, e.increment,
  );

// Sets from the most recent workout that had this exercise.
export const lastSets = (db: SQLiteDatabase, exId: string) =>
  db.getAllAsync<S>(
    'SELECT weight, reps FROM sets WHERE exercise_id = ? AND workout_id = (SELECT MAX(workout_id) FROM sets WHERE exercise_id = ?) ORDER BY idx',
    exId, exId,
  );

export const history = (db: SQLiteDatabase, exId: string) =>
  db.getAllAsync<S>('SELECT weight, reps FROM sets WHERE exercise_id = ?', exId);

export async function makeBlock(db: SQLiteDatabase, ex: Exercise): Promise<Block> {
  const prev = await lastSets(db, ex.id);
  const n = prev.length || 3;
  return { ex, prev, sugg: suggest(prev, ex), sets: Array.from({ length: n }, () => ({ weight: '', reps: '', done: false })) };
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
