import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Shiba } from '../../components/Shiba';
import { Btn, Card, Txt, kg, useTheme } from '../../components/ui';
import {
  getDraft, listRoutines, listWorkouts, makeBlock, routineBlocks, setDraft, workoutExercises,
  type Block, type Draft, type Routine, type WorkoutRow,
} from '../../lib/db';

const newDraft = (name: string, blocks: Block[], routineId?: number): Draft => ({ name, startedAt: Date.now(), blocks, routineId });

export default function Workout() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [draft, setDraftState] = useState<Draft | null>(null);
  const [past, setPast] = useState<WorkoutRow[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);

  useFocusEffect(useCallback(() => {
    getDraft(db).then(setDraftState);
    listWorkouts(db).then(setPast);
    listRoutines(db).then(setRoutines);
  }, [db]));

  const begin = async (name: string, blocks: Block[], routineId?: number) => {
    if (draft) return Alert.alert('Workout in progress', 'Finish or discard your current workout first.');
    await setDraft(db, newDraft(name, blocks, routineId));
    router.push('/active');
  };
  const repeat = async (w: WorkoutRow) =>
    begin(w.name, await Promise.all((await workoutExercises(db, w.id)).map(e => makeBlock(db, e))));

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Card style={{ alignItems: 'center', gap: 10 }}>
        <Shiba size={90} mood={draft ? 'hype' : 'happy'} />
        {draft ? <>
          <Txt weight="black" size={18}>Workout in progress!</Txt>
          <Btn title="Resume workout" onPress={() => router.push('/active')} />
        </> : <>
          <Txt weight="black" size={18}>Ready to lift, fren?</Txt>
          <Btn title="Start empty workout" onPress={() => begin('Workout', [])} />
        </>}
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
        <Txt weight="black" size={18} style={{ flex: 1 }}>Routines</Txt>
        <Btn small variant="ghost" title="+ New routine" onPress={() => router.push('/routine')} />
      </View>
      {routines.length === 0 && <Txt size={13} color={t.sub}>Save your Push / Pull / Legs here and start them with one tap.</Txt>}
      {routines.map(r => (
        <Pressable key={r.id} onPress={async () => begin(r.name, await routineBlocks(db, r), r.id)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Txt weight="black" size={16}>{r.name}</Txt>
              <Txt size={12} color={t.sub} numberOfLines={2}>{r.items.map(i => i.name).join(' · ')}</Txt>
            </View>
            <Btn small variant="ghost" title="Edit" onPress={() => router.push({ pathname: '/routine', params: { id: r.id } })} />
            <Txt weight="black" color={t.primary} size={18}>▶</Txt>
          </Card>
        </Pressable>
      ))}

      {past.length > 0 && <>
        <Txt weight="black" size={18} style={{ marginTop: 8 }}>Repeat a workout</Txt>
        <Txt size={13} color={t.sub} style={{ marginTop: -8 }}>Same exercises, with Shiba’s suggested weights and reps.</Txt>
        {past.filter((w, i) => past.findIndex(x => x.name === w.name) === i).slice(0, 10).map(w => (
          <Pressable key={w.id} onPress={() => repeat(w)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Txt weight="bold">{w.name}</Txt>
                <Txt size={12} color={t.sub}>{new Date(w.started_at).toLocaleDateString()} · {w.sets} set{w.sets === 1 ? '' : 's'} · {kg(w.volume)}</Txt>
              </View>
              <Txt weight="black" color={t.primary}>▶</Txt>
            </Card>
          </Pressable>
        ))}
      </>}
    </ScrollView>
  );
}
