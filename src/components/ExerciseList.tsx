import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { getExercises, saveExercise, type Exercise } from '../lib/db';
import { Btn, Card, Input, Txt, useTheme } from './ui';

const cap = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());

// Library browser. With onPick it's a picker (tap = choose); without, tap = edit rep range / progression.
export function ExerciseList({ onPick }: { onPick?: (e: Exercise) => void }) {
  const db = useSQLiteContext();
  const t = useTheme();
  const [all, setAll] = useState<Exercise[]>([]);
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [editing, setEditing] = useState<Exercise | null>(null);

  const load = useCallback(() => { getExercises(db).then(setAll); }, [db]);
  useFocusEffect(load);

  const muscles = useMemo(() => [...new Set(all.map(e => e.muscle))].sort(), [all]);
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter(e => (!muscle || e.muscle === muscle) && words.every(w => e.name.toLowerCase().includes(w)));
  }, [all, q, muscle]);

  const blank: Exercise = { id: '', name: q, muscle: muscle ?? 'chest', equipment: 'barbell', custom: 1, rep_min: 8, rep_max: 12, increment: 2.5 };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
        <Input placeholder={`Search ${all.length} exercises…`} value={q} onChangeText={setQ} style={{ flex: 1 }} />
        <Btn small title="+ Custom" onPress={() => setEditing(blank)} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginVertical: 10 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
        {[null, ...muscles].map(m => {
          const on = muscle === m;
          return (
            <Pressable key={m ?? 'all'} onPress={() => setMuscle(m)} style={{ backgroundColor: on ? t.primary : t.card, borderColor: t.line, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Txt weight="bold" size={13} color={on ? '#fff' : t.text}>{m ? cap(m) : 'All'}</Txt>
            </Pressable>
          );
        })}
      </ScrollView>
      <FlatList
        data={shown}
        keyExtractor={e => e.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 8 }}
        ListEmptyComponent={<Txt color={t.sub} style={{ textAlign: 'center', marginTop: 30 }}>No exercise found. Add it as a custom one!</Txt>}
        renderItem={({ item }) => (
          <Pressable onPress={() => (onPick ? onPick(item) : setEditing(item))}>
            <Card style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Txt weight="bold">{item.name}{item.custom ? ' ⭐' : ''}</Txt>
                <Txt size={12} color={t.sub}>{cap(item.muscle)} · {cap(item.equipment)} · {item.rep_min}–{item.rep_max} reps</Txt>
              </View>
              <Txt weight="black" color={t.primary} size={18}>{onPick ? '+' : '›'}</Txt>
            </Card>
          </Pressable>
        )}
      />
      {editing && <ExerciseForm initial={editing} muscles={muscles} onClose={saved => { setEditing(null); if (saved) load(); }} />}
    </View>
  );
}

function ExerciseForm({ initial, muscles, onClose }: { initial: Exercise; muscles: string[]; onClose: (saved: boolean) => void }) {
  const db = useSQLiteContext();
  const t = useTheme();
  const [f, setF] = useState({ ...initial, rep_min: String(initial.rep_min), rep_max: String(initial.rep_max), increment: String(initial.increment) });
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  const save = async () => {
    const rep_min = parseInt(f.rep_min), rep_max = parseInt(f.rep_max), increment = parseFloat(f.increment.replace(',', '.'));
    if (!f.name.trim()) return Alert.alert('Name it!', 'Every good exercise needs a name.');
    if (!(rep_min > 0 && rep_max >= rep_min && increment >= 0)) return Alert.alert('Check the numbers', 'Rep range must be like 8–12 and the increment ≥ 0.');
    const id = f.id || `custom-${Date.now()}`;
    await saveExercise(db, { ...f, id, name: f.name.trim(), muscle: f.muscle.trim().toLowerCase() || 'other', equipment: f.equipment.trim().toLowerCase() || 'other', rep_min, rep_max, increment });
    onClose(true);
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={() => onClose(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <ScrollView style={{ flexGrow: 0, backgroundColor: t.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 }} contentContainerStyle={{ padding: 20, gap: 10 }} keyboardShouldPersistTaps="handled">
          <Txt weight="black" size={22}>{initial.id ? 'Edit exercise' : 'New custom exercise 🐾'}</Txt>
          {(!initial.id || initial.custom === 1) && <>
            <Input placeholder="Name (e.g. Shiba Squat)" value={f.name} onChangeText={set('name')} />
            <Input placeholder="Muscle" value={f.muscle} onChangeText={set('muscle')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
              {muscles.map(m => <Btn key={m} small variant={f.muscle === m ? 'primary' : 'ghost'} title={cap(m)} onPress={() => set('muscle')(m)} />)}
            </ScrollView>
            <Input placeholder="Equipment (barbell, dumbbell, machine…)" value={f.equipment} onChangeText={set('equipment')} />
          </>}
          {initial.id && initial.custom !== 1 && <Txt weight="bold" size={17}>{initial.name}</Txt>}
          <Txt weight="bold" color={t.sub}>Progressive overload</Txt>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Input keyboardType="number-pad" value={f.rep_min} onChangeText={set('rep_min')} style={{ flex: 1, textAlign: 'center' }} />
            <Txt weight="bold">to</Txt>
            <Input keyboardType="number-pad" value={f.rep_max} onChangeText={set('rep_max')} style={{ flex: 1, textAlign: 'center' }} />
            <Txt weight="bold">reps</Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Txt weight="bold">Add</Txt>
            <Input keyboardType="decimal-pad" value={f.increment} onChangeText={set('increment')} style={{ flex: 1, textAlign: 'center' }} />
            <Txt weight="bold">kg when you hit the top</Txt>
          </View>
          <Txt size={12} color={t.sub}>Hit the top of the range on every set and Shiba bumps the weight next time. Otherwise aim for +1 rep.</Txt>
          <Btn title="Save" onPress={save} />
          <Btn variant="ghost" title="Cancel" onPress={() => onClose(false)} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
