import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Shiba } from '../../components/Shiba';
import { Btn, Card, Txt, kg, useTheme } from '../../components/ui';
import { getDraft, listWorkouts, makeBlock, setDraft, workoutExercises, type Draft, type WorkoutRow } from '../../lib/db';

export default function Workout() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [draft, setDraftState] = useState<Draft | null>(null);
  const [past, setPast] = useState<WorkoutRow[]>([]);

  useFocusEffect(useCallback(() => {
    getDraft(db).then(setDraftState);
    listWorkouts(db).then(setPast);
  }, [db]));

  const start = async (name = 'Workout', fromId?: number) => {
    const exs = fromId ? await workoutExercises(db, fromId) : [];
    const blocks = await Promise.all(exs.map(e => makeBlock(db, e)));
    await setDraft(db, { name, startedAt: Date.now(), blocks });
    router.push('/active');
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Card style={{ alignItems: 'center', gap: 10 }}>
        <Shiba size={90} mood={draft ? 'hype' : 'happy'} />
        {draft ? <>
          <Txt weight="black" size={18}>Workout in progress!</Txt>
          <Btn title="Resume workout" onPress={() => router.push('/active')} />
        </> : <>
          <Txt weight="black" size={18}>Ready to lift, fren?</Txt>
          <Btn title="Start empty workout" onPress={() => start()} />
        </>}
      </Card>

      {!draft && past.length > 0 && <>
        <Txt weight="black" size={18} style={{ marginTop: 8 }}>Repeat a workout</Txt>
        <Txt size={13} color={t.sub} style={{ marginTop: -8 }}>Same exercises, with Shiba’s suggested weights and reps.</Txt>
        {past.filter((w, i) => past.findIndex(x => x.name === w.name) === i).slice(0, 10).map(w => (
          <Pressable key={w.id} onPress={() => start(w.name, w.id)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Txt weight="bold">{w.name}</Txt>
                <Txt size={12} color={t.sub}>{new Date(w.started_at).toLocaleDateString()} · {w.sets} sets · {kg(w.volume)}</Txt>
              </View>
              <Txt weight="black" color={t.primary}>▶</Txt>
            </Card>
          </Pressable>
        ))}
      </>}
    </ScrollView>
  );
}
