import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Chart } from '../components/Chart';
import { Btn, Card, Txt, kg, screenTheme, setText, useTheme } from '../components/ui';
import { exerciseSets, overloadSessions, type SetRow } from '../lib/db';
import { e1rm, overload, sessionKey } from '../lib/progression';

// Per session, working sets only (warm-ups never count). e1RM is 0 for sessions with only 13+ rep sets: left off that chart.
const METRICS = {
  top: { label: 'Heaviest', of: (w: SetRow[]) => Math.max(0, ...w.map(s => s.weight)) },
  e1rm: { label: 'Est. 1RM', of: (w: SetRow[]) => Math.max(0, ...w.map(e1rm)) },
  volume: { label: 'Volume', of: (w: SetRow[]) => w.reduce((a, s) => a + s.weight * s.reps, 0) },
};

export default function ExerciseProgress() {
  const db = useSQLiteContext();
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rows, setRows] = useState<SetRow[]>([]);
  const [ov, setOv] = useState(() => overload([]));
  const [metric, setMetric] = useState<keyof typeof METRICS>('top');

  useEffect(() => {
    exerciseSets(db, id).then(setRows);
    overloadSessions(db, id).then(s => setOv(overload(s)));
  }, [db, id]);

  // Newest first, one entry per workout.
  const sessions = useMemo(() => {
    const m = new Map<number, SetRow[]>();
    for (const r of rows) m.set(r.workout_id, [...(m.get(r.workout_id) ?? []), r]);
    return [...m.values()].map(sets => ({ ...sets[0], sets, work: sets.filter(s => !s.warmup) }));
  }, [rows]);
  const worked = sessions.filter(s => s.work.length);
  const points = worked.slice(0, 30).reverse() // ponytail: last 30 sessions only, add a range picker if older ones matter
    .map(s => ({ t: s.started_at, y: METRICS[metric].of(s.work) })).filter(p => p.y > 0 || metric === 'top');

  const stat = (value: string, label: string) => (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 12 }}>
      <Txt weight="black" size={18} color={t.primaryDark}>{value}</Txt>
      <Txt size={12} color={t.sub}>{label}</Txt>
    </Card>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ ...screenTheme(t), title: rows[0]?.name ?? 'Exercise' }} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {stat(kg(Math.max(0, ...worked.map(s => METRICS.top.of(s.work)))), 'heaviest')}
        {stat(kg(Math.round(Math.max(0, ...worked.map(s => METRICS.e1rm.of(s.work))) * 2) / 2), 'best e1RM')}
        {stat(`🔥 ${ov.current}`, `streak · best ${ov.best}`)}
      </View>
      <Txt size={12} color={t.sub} style={{ marginTop: -4 }}>Streak = sessions in a row where you beat last time: more weight, or more reps at your top weight.</Txt>

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(Object.keys(METRICS) as (keyof typeof METRICS)[]).map(k => (
            <Btn key={k} small variant={metric === k ? 'primary' : 'ghost'} title={METRICS[k].label} onPress={() => setMetric(k)} />
          ))}
        </View>
        <Chart key={metric} points={points} fmt={kg} change />
      </Card>

      <Txt weight="black" size={18}>History</Txt>
      {sessions.map(s => (
        <Card key={s.workout_id} style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Txt weight="bold" style={{ flex: 1 }}>{new Date(s.started_at).toLocaleDateString()}</Txt>
            {ov.up.has(sessionKey(s)) && <Txt weight="bold" color={t.good}>▲ beat last time</Txt>}
          </View>
          <Txt size={13} color={t.sub}>{s.sets.map(setText).join(' · ')}</Txt>
        </Card>
      ))}
    </ScrollView>
  );
}
