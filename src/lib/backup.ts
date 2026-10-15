import type { SQLiteDatabase } from 'expo-sqlite';

// Whole-database backup as JSON: every row of every table. The in-progress workout (kv 'draft') stays out.
const TABLES = ['exercises', 'workouts', 'sets', 'routines', 'bodyweight', 'kv'] as const;
type Row = Record<string, string | number | null>;
export type Backup = { app: 'shiba-lift'; schema: number; exportedAt: number; tables: Record<string, Row[]> };

export async function exportAll(db: SQLiteDatabase, schema: number): Promise<Backup> {
  const tables: Record<string, Row[]> = {};
  for (const t of TABLES) tables[t] = await db.getAllAsync<Row>(`SELECT * FROM ${t}${t === 'kv' ? " WHERE k != 'draft'" : ''}`);
  return { app: 'shiba-lift', schema, exportedAt: Date.now(), tables };
}

// Throws a readable message for anything that isn't a backup this version of the app can restore.
export function parseBackup(text: string, schema: number): Backup {
  let b: Backup;
  try { b = JSON.parse(text); } catch { throw new Error('That file isn’t a Shiba Lift backup.'); }
  if (b?.app !== 'shiba-lift' || typeof b.tables !== 'object' || !Array.isArray(b.tables?.workouts)) throw new Error('That file isn’t a Shiba Lift backup.');
  if (b.schema > schema) throw new Error('That backup is from a newer version of Shiba Lift. Update the app first.');
  return b;
}

// Replaces everything (except the in-progress workout) in one transaction: a bad file leaves the old data untouched.
// Only columns that exist in this app's tables are written; columns an older backup lacks get their defaults.
export async function restoreAll(db: SQLiteDatabase, b: Backup) {
  await db.withTransactionAsync(async () => {
    for (const t of TABLES) {
      await db.runAsync(t === 'kv' ? "DELETE FROM kv WHERE k != 'draft'" : `DELETE FROM ${t}`);
      const rows = (b.tables[t] ?? []).filter(r => t !== 'kv' || r.k !== 'draft');
      if (!rows.length) continue;
      const known = new Set((await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`)).map(c => c.name));
      const cols = Object.keys(rows[0]).filter(c => known.has(c));
      const st = await db.prepareAsync(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`);
      try {
        for (const r of rows) await st.executeAsync(cols.map(c => r[c] ?? null));
      } finally {
        await st.finalizeAsync();
      }
    }
  });
  return { workouts: b.tables.workouts.length, sets: b.tables.sets?.length ?? 0 };
}
