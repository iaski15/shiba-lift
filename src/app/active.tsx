import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExerciseList } from '../components/ExerciseList';
import { OrderControls, PairBanner } from '../components/OrderControls';
import { PRPopup, type PRInfo } from '../components/PRPopup';
import { RestTimer, cancelRestNotification } from '../components/RestTimer';
import { Btn, Card, Txt, font, screenTheme, useTheme } from '../components/ui';
import { getDraft, history, makeBlock, saveRoutine, saveWorkout, setDraft, type Draft } from '../lib/db';
import { isPR } from '../lib/progression';
import { removeAt } from '../lib/superset';
import { supabase } from '../lib/supabase';

const REST_SECONDS = 120; // ponytail: one global rest time; per-exercise rest if people ask

const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));

export default function Active() {
  const db = useSQLiteContext();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<Draft | null>(null);
  const [pr, setPr] = useState<PRInfo | null>(null);
  const [picking, setPicking] = useState(false);
  const [pairFrom, setPairFrom] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDraft(db).then(x => {
      if (!x) return router.back();
      if (x.restEnd && x.restEnd <= Date.now()) delete x.restEnd; // rest finished while away: no stray buzz on return
      setD(x);
    });
  }, [db]);
  useEffect(() => { if (d) setDraft(db, d); }, [db, d]); // persist every change so a crash never loses a session

  const edit = (fn: (x: Draft) => void) => setD(prev => {
    const x: Draft = JSON.parse(JSON.stringify(prev));
    fn(x);
    return x;
  });

  if (!d) return null;

  // Rest end time lives in the draft, so leaving the screen (or the app being killed) doesn't lose the timer.
  const restEnd = d.restEnd ?? null;
  const setRestEnd = (t: number | null) => edit(x => { x.restEnd = t ?? undefined; });

  const toggle = async (bi: number, si: number) => {
    const b = d.blocks[bi], s = b.sets[si];
    if (s.done) return edit(x => { x.blocks[bi].sets[si].done = false; });
    const sg = b.sugg[si] ?? b.sugg[b.sugg.length - 1];
    const weight = num(s.weight) ?? sg?.weight, reps = num(s.reps) ?? sg?.reps;
    if (weight === undefined || reps === undefined || !(weight >= 0) || !(reps > 0) || !Number.isInteger(reps)) {
      return Alert.alert('Hmm 🐕', 'Enter a weight (0 for bodyweight) and whole reps first.');
    }
    const hist = [...(await history(db, b.ex.id)), ...b.sets.filter((o, i) => o.done && i !== si).map(o => ({ weight: +o.weight, reps: +o.reps }))];
    const kind = isPR({ weight, reps }, hist);
    edit(x => {
      x.blocks[bi].sets[si] = { weight: String(weight), reps: String(reps), done: true };
      if (kind) x.prs = (x.prs ?? 0) + 1;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!(b.linked && bi < d.blocks.length - 1)) setRestEnd(Date.now() + REST_SECONDS * 1000); // mid-superset: go straight to the next exercise
    if (kind) setPr({ kind, exercise: b.ex.name, weight, reps });
  };

  const finish = async () => {
    const done = d.blocks.flatMap(b => b.sets.filter(s => s.done));
    if (!done.length) return discard();
    setSaving(true);
    try {
      await saveWorkout(db, d);
      await setDraft(db, null);
    } catch (e) {
      setSaving(false);
      return Alert.alert('Could not save', String(e));
    }
    cancelRestNotification(); // not setRestEnd(null): that edits the draft and would re-save the finished workout
    const summary = summarize(d);
    let shared = false;
    if (supabase && (await supabase.auth.getSession()).data.session) {
      shared = !(await supabase.from('posts').insert({ title: d.name, summary })).error;
    }
    const { minutes, volume, sets, prs } = summary;
    router.replace({ pathname: '/summary', params: { name: d.name, minutes, volume, sets, prs, shared: shared ? 1 : 0 } });
  };

  const saveAsRoutine = async () => {
    const items = d.blocks.map(b => ({ id: b.ex.id, name: b.ex.name, sets: b.sets.length, linked: b.linked }));
    const id = await saveRoutine(db, { id: d.routineId, name: d.name.trim() || 'Routine', items });
    edit(x => { x.routineId = id; });
    Alert.alert(d.routineId ? 'Routine updated 🐾' : 'Routine saved 🐾', `"${d.name.trim() || 'Routine'}" is on the Workout tab.`);
  };

  const discard = () => Alert.alert('Discard workout?', 'Nothing will be saved.', [
    { text: 'Keep going', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: async () => { await setDraft(db, null); setD(null); cancelRestNotification(); router.back(); } },
  ]);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{
        ...screenTheme(t),
        headerLeft: () => <Btn small variant="ghost" title="Discard" onPress={discard} />,
        headerRight: () => <Btn small title={saving ? '…' : 'Finish'} disabled={saving} onPress={finish} />,
        headerTitle: () => <Elapsed since={d.startedAt} />,
      }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          <TextInput
            value={d.name}
            onChangeText={v => edit(x => { x.name = v; })}
            style={{ fontFamily: font.black, fontSize: 26, color: t.text }}
            placeholder="Workout name"
            placeholderTextColor={t.sub}
          />
          {pairFrom !== null && d.blocks[pairFrom] && <PairBanner name={d.blocks[pairFrom].ex.name} onCancel={() => setPairFrom(null)} />}
          {/* Keyed by exercise (not position): after reordering, Android otherwise keeps stale placeholder hints in reused inputs */}
          {d.blocks.map((b, bi) => {
            const linkedNext = !!b.linked && bi < d.blocks.length - 1;
            const inSuperset = linkedNext || !!d.blocks[bi - 1]?.linked;
            return (
            <Card key={`${b.ex.id}#${d.blocks.slice(0, bi).filter(o => o.ex.id === b.ex.id).length}`} style={[{ gap: 6 }, inSuperset && { borderLeftWidth: 6, borderLeftColor: t.superset }, linkedNext && { marginBottom: -6 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  {inSuperset && <Txt weight="black" size={11} color={t.superset}>🔗 SUPERSET</Txt>}
                  <Txt weight="black" size={17} color={t.primaryDark}>{b.ex.name}</Txt>
                  <Txt size={12} color={t.sub}>
                    {b.ex.rep_min}–{b.ex.rep_max} reps · +{b.ex.increment}kg at top
                    {b.sugg.length > 0 && b.sugg[b.sugg.length - 1].weight > (b.prev[b.prev.length - 1]?.weight ?? 0) ? ' · ⬆ Time to go heavier!' : ''}
                  </Txt>
                </View>
                <Pressable hitSlop={10} accessibilityLabel="Remove exercise" onPress={() => Alert.alert('Remove exercise?', b.ex.name, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => { setPairFrom(null); edit(x => { x.blocks = removeAt(x.blocks, bi); }); } },
                ])}>
                  <Txt weight="black" color={t.sub} size={18}>✕</Txt>
                </Pressable>
              </View>
              <OrderControls items={d.blocks} index={bi} pairFrom={pairFrom} setPairFrom={setPairFrom}
                onChange={blocks => edit(x => { x.blocks = blocks; })} />
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
                {['SET', 'PREVIOUS', 'KG', 'REPS', '✓'].map((h, i) => (
                  <Txt key={h} weight="bold" size={11} color={t.sub} style={{ width: [32, undefined, 66, 56, 40][i], flex: i === 1 ? 1 : undefined, textAlign: 'center' }}>{h}</Txt>
                ))}
              </View>
              {b.sets.map((s, si) => {
                const sg = b.sugg[si] ?? b.sugg[b.sugg.length - 1];
                const p = b.prev[si];
                const cell = { width: 66, textAlign: 'center' as const, fontFamily: font.bold, fontSize: 16, color: t.text, backgroundColor: s.done ? 'transparent' : t.input, borderRadius: 10, paddingVertical: 6 };
                return (
                  <View key={si} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: s.done ? t.good + '33' : 'transparent', borderRadius: 12, padding: 4 }}>
                    <Pressable style={{ width: 32 }} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Delete set ${si + 1}`}
                      onPress={() => Alert.alert(`Delete set ${si + 1}?`, b.ex.name, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => edit(x => { x.blocks[bi].sets.splice(si, 1); }) },
                      ])}>
                      <Txt weight="black" style={{ textAlign: 'center' }}>{si + 1}</Txt>
                    </Pressable>
                    <Txt size={13} color={t.sub} style={{ flex: 1, textAlign: 'center' }}>{p ? `${p.weight}×${p.reps}` : '—'}</Txt>
                    <TextInput style={cell} keyboardType="decimal-pad" value={s.weight} placeholder={sg ? String(sg.weight) : ''} placeholderTextColor={t.sub}
                      onChangeText={v => edit(x => { x.blocks[bi].sets[si].weight = v; })} selectTextOnFocus />
                    <TextInput style={{ ...cell, width: 56 }} keyboardType="number-pad" value={s.reps} placeholder={sg ? String(sg.reps) : ''} placeholderTextColor={t.sub}
                      onChangeText={v => edit(x => { x.blocks[bi].sets[si].reps = v; })} selectTextOnFocus />
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: s.done }} onPress={() => toggle(bi, si)}
                      style={{ width: 40, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: s.done ? t.good : t.line }}>
                      <Txt weight="black" color={s.done ? '#fff' : t.sub}>✓</Txt>
                    </Pressable>
                  </View>
                );
              })}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Btn small variant="ghost" title="− Remove set" disabled={b.sets.length <= 1}
                    onPress={() => edit(x => { x.blocks[bi].sets.pop(); })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Btn small variant="ghost" title="+ Add set" onPress={() => edit(x => { x.blocks[bi].sets.push({ weight: '', reps: '', done: false }); })} />
                </View>
              </View>
            </Card>
            );
          })}
          {d.blocks.length === 0 && <Txt color={t.sub} style={{ textAlign: 'center', marginVertical: 20 }}>Add an exercise to get started 🐾</Txt>}
          <Btn title="+ Add exercise" onPress={() => setPicking(true)} />
          {d.blocks.length > 0 && <Btn variant="ghost" title={d.routineId ? '💾 Update routine' : '💾 Save as routine'} onPress={saveAsRoutine} />}
          <Txt size={11} color={t.sub} style={{ textAlign: 'center' }}>Grey numbers are Shiba’s suggestion. Tap ✓ to use them. Tap a set number to delete that set.</Txt>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ position: 'absolute', left: 12, right: 12, bottom: insets.bottom + 12 }}>
        <RestTimer endAt={restEnd} setEndAt={setRestEnd} />
      </View>

      <Modal visible={picking} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicking(false)}>
        <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 }}>
            <Txt weight="black" size={22} style={{ flex: 1 }}>Add exercise</Txt>
            <Btn small variant="ghost" title="Close" onPress={() => setPicking(false)} />
          </View>
          <ExerciseList onPick={async ex => {
            setPicking(false);
            const block = await makeBlock(db, ex);
            edit(x => { x.blocks.push(block); });
          }} />
        </View>
      </Modal>

      <PRPopup pr={pr} onClose={() => setPr(null)} />
    </View>
  );
}

function summarize(d: Draft) {
  const done = d.blocks.flatMap(b => b.sets.filter(s => s.done));
  return {
    minutes: Math.round((Date.now() - d.startedAt) / 60000),
    volume: done.reduce((a, s) => a + +s.weight * +s.reps, 0),
    sets: done.length,
    prs: d.prs ?? 0,
    exercises: d.blocks.filter(b => b.sets.some(s => s.done)).map(b => {
      const sets = b.sets.filter(s => s.done);
      const best = sets.reduce((a, s) => (+s.weight > +a.weight || (+s.weight === +a.weight && +s.reps > +a.reps) ? s : a));
      return { name: b.ex.name, sets: sets.length, best: `${best.weight} kg × ${best.reps}` };
    }),
  };
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  const s = Math.floor((now - since) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return <Txt weight="black" size={17}>⏱ {h ? `${h}:` : ''}{String(m).padStart(h ? 2 : 1, '0')}:{String(s % 60).padStart(2, '0')}</Txt>;
}
