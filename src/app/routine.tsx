import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import { ExerciseList } from '../components/ExerciseList';
import { Btn, Card, Input, Txt, screenTheme, useTheme } from '../components/ui';
import { deleteRoutine, getRoutine, saveRoutine, type RoutineItem } from '../lib/db';

export default function RoutineEditor() {
  const db = useSQLiteContext();
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const rid = id ? Number(id) : undefined;
  const [name, setName] = useState('');
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (rid) getRoutine(db, rid).then(r => { if (r) { setName(r.name); setItems(r.items); } });
  }, [db, rid]);

  const edit = (fn: (x: RoutineItem[]) => void) => setItems(prev => { const x = prev.map(i => ({ ...i })); fn(x); return x; });

  const save = async () => {
    if (!name.trim()) return Alert.alert('Name it!', 'e.g. Push, Pull or Legs.');
    if (!items.length) return Alert.alert('Empty routine', 'Add at least one exercise.');
    await saveRoutine(db, { id: rid, name: name.trim(), items });
    router.back();
  };

  const remove = () => Alert.alert('Delete routine?', name, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await deleteRoutine(db, rid!); router.back(); } },
  ]);

  const chip = (label: string, onPress: () => void, on = false) => (
    <Pressable hitSlop={6} onPress={onPress} accessibilityRole="button"
      style={{ backgroundColor: on ? t.superset : t.line, borderRadius: 999, minWidth: 34, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5 }}>
      <Txt weight="black" size={13} color={on ? '#fff' : t.text}>{label}</Txt>
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ ...screenTheme(t), title: rid ? 'Edit routine' : 'New routine', headerRight: () => <Btn small title="Save" onPress={save} /> }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Input placeholder="Routine name (e.g. Push)" value={name} onChangeText={setName} style={{ fontSize: 20 }} />
        {items.map((it, i) => {
          const linkedNext = !!it.linked && i < items.length - 1;
          const inSuperset = linkedNext || !!items[i - 1]?.linked;
          return (
            <Card key={`${it.id}-${i}`} style={[{ gap: 8 }, inSuperset && { borderLeftWidth: 6, borderLeftColor: t.superset }]}>
              {inSuperset && <Txt weight="black" size={11} color={t.superset}>🔗 SUPERSET</Txt>}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt weight="black" size={16} color={t.primaryDark} style={{ flex: 1 }}>{it.name}</Txt>
                {i > 0 && chip('↑', () => edit(x => { [x[i - 1], x[i]] = [x[i], x[i - 1]]; }))}
                {chip('✕', () => edit(x => { x.splice(i, 1); }))}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {chip('−', () => edit(x => { x[i].sets = Math.max(1, x[i].sets - 1); }))}
                <Txt weight="bold">{it.sets} set{it.sets === 1 ? '' : 's'}</Txt>
                {chip('+', () => edit(x => { x[i].sets = Math.min(20, x[i].sets + 1); }))}
                <View style={{ flex: 1 }} />
                {i < items.length - 1 && chip(`🔗 ${linkedNext ? 'Linked' : 'Superset'}`, () => edit(x => { x[i].linked = !linkedNext; }), linkedNext)}
              </View>
            </Card>
          );
        })}
        <Btn title="+ Add exercise" onPress={() => setPicking(true)} />
        {rid && <Btn variant="ghost" title="Delete routine" onPress={remove} />}
      </ScrollView>

      <Modal visible={picking} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicking(false)}>
        <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 }}>
            <Txt weight="black" size={22} style={{ flex: 1 }}>Add exercise</Txt>
            <Btn small variant="ghost" title="Close" onPress={() => setPicking(false)} />
          </View>
          <ExerciseList onPick={ex => { setPicking(false); edit(x => { x.push({ id: ex.id, name: ex.name, sets: 3 }); }); }} />
        </View>
      </Modal>
    </View>
  );
}
