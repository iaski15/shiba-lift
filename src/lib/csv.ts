// Hevy export: Profile → Settings → Export & Import Data → Export workouts. One row per set:
// title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg|weight_lbs,reps,…

export type ImportedSet = { exercise: string; weight: number; reps: number; warmup?: boolean };
// hevyId set = came from the Hevy API: replaces any existing copy (incl. a CSV-imported one) instead of being skipped.
export type ImportedWorkout = { name: string; start: number; end: number; sets: ImportedSet[]; hevyId?: string };

// RFC 4180: quoted fields, "" escapes, commas/newlines inside quotes, CRLF, BOM.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(f => f !== '')) rows.push(row);
  return rows;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Hevy writes local wall time like "01 Aug 2024, 18:23". Fall back to anything Date can parse (ISO).
export function parseHevyDate(s: string): number {
  const m = s.trim().match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4}),? (\d{1,2}):(\d{2})/);
  if (m) {
    const mon = MONTHS.indexOf(m[2].toLowerCase());
    if (mon >= 0) return new Date(+m[3], mon, +m[1], +m[4], +m[5]).getTime();
  }
  return Date.parse(s);
}

export function parseHevy(text: string): ImportedWorkout[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error('The file is empty.');
  const col = Object.fromEntries(header.map((h, i) => [h.trim().toLowerCase(), i]));
  const wCol = col.weight_kg ?? col.weight_lbs;
  const missing = ['title', 'start_time', 'exercise_title', 'reps'].filter(k => col[k] === undefined);
  if (missing.length || wCol === undefined) {
    throw new Error(`This doesn't look like a Hevy workout export (missing: ${[...missing, ...(wCol === undefined ? ['weight_kg'] : [])].join(', ')}).`);
  }
  const toKg = col.weight_kg !== undefined ? 1 : 0.45359237;

  const byKey = new Map<string, ImportedWorkout>();
  for (const r of rows) {
    const start = parseHevyDate(r[col.start_time] ?? '');
    const exercise = (r[col.exercise_title] ?? '').trim();
    const reps = Math.round(Number(r[col.reps]));
    if (!Number.isFinite(start) || !exercise || !(reps > 0)) continue; // cardio / timed holds have no reps
    const weight = Math.round((Number(r[wCol]) || 0) * toKg * 100) / 100;
    const name = (r[col.title] ?? '').trim() || 'Workout';
    const key = `${name}|${start}`;
    let w = byKey.get(key);
    if (!w) {
      const end = col.end_time !== undefined ? parseHevyDate(r[col.end_time] ?? '') : NaN;
      w = { name, start, end: Number.isFinite(end) ? end : start, sets: [] };
      byKey.set(key, w);
    }
    w.sets.push({ exercise, weight, reps, ...(r[col.set_type]?.trim().toLowerCase() === 'warmup' ? { warmup: true } : {}) });
  }
  return [...byKey.values()].sort((a, b) => a.start - b.start);
}
