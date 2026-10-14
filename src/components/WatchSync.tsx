import { router } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import ShibaWear from '../../modules/shiba-wear';
import { getDraft, getKv, getRoutine, listRoutines, newDraft, routineBlocks, setDraft, setKv } from '../lib/db';
import { newActions, watchState, type WatchAction } from '../lib/watch';

let ack = 0; // id of the last watch tap handled (persisted as kv watch_ack)
let activeHandler: ((a: WatchAction) => unknown) | null = null;
let opening = false;
const pending: WatchAction[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

// Sends the current draft to the watch. Debounced: typing a weight is many draft saves.
export function publishWatch(db: SQLiteDatabase) {
  if (!ShibaWear) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    ShibaWear!.publish(watchState(await getDraft(db), await listRoutines(db), ack)).catch(() => {});
  }, 300);
}

// Rendered by the active-workout screen once its draft has loaded: watch taps then go through the same code as a tap
// on the phone (PR check, rest timer, finish + Hevy post).
export function WatchActions({ onAction }: { onAction: (a: WatchAction) => unknown }) {
  const latest = useRef(onAction);
  useEffect(() => { latest.current = onAction; });
  useEffect(() => {
    activeHandler = a => latest.current(a);
    opening = false;
    for (const a of pending.splice(0)) activeHandler(a);
    return () => { activeHandler = null; };
  }, []);
  return null;
}

async function handle(db: SQLiteDatabase, a: WatchAction) {
  if (activeHandler) return activeHandler(a);
  const d = await getDraft(db);
  if (a.type === 'start') {
    if (d) return; // a workout is already going: the watch gets it with the next publish
    const r = a.routineId ? await getRoutine(db, a.routineId) : null;
    await setDraft(db, newDraft(r?.name ?? 'Workout', r ? await routineBlocks(db, r) : [], r?.id ?? undefined));
  } else {
    if (!d) return;
    pending.push(a);
  }
  if (!opening) { opening = true; router.push('/active'); }
}

// Mounted once at the root: picks up watch taps (also ones made while the app was closed) and tells the watch the state.
export function WatchSync() {
  const db = useSQLiteContext();
  useEffect(() => {
    if (!ShibaWear) return;
    let busy = Promise.resolve();
    const drain = () => {
      busy = busy.then(async () => {
        const acts = newActions(await ShibaWear!.pendingActions(), ack, Date.now());
        if (!acts.length) return;
        ack = acts[acts.length - 1].id;
        await setKv(db, 'watch_ack', String(ack));
        for (const a of acts) await handle(db, a);
        publishWatch(db); // new ack lets the watch delete its handled taps
      }).catch(() => {});
    };
    getKv(db, 'watch_ack').then(v => {
      ack = Number(v) || 0;
      publishWatch(db);
      drain();
    });
    const sub = ShibaWear.addListener('onAction', drain);
    return () => sub.remove();
  }, [db]);
  return null;
}
