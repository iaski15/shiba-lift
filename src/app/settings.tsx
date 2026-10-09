import { router, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { ProgressionFields, toText, type RangeText } from '../components/ProgressionFields';
import { Btn, Card, Txt, screenTheme, useTheme } from '../components/ui';
import { getProgDefaults, setProgDefaults } from '../lib/db';
import { DEFAULT_RANGE, parseRange } from '../lib/progression';

export default function Settings() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [range, setRange] = useState<RangeText>(toText(DEFAULT_RANGE));
  useEffect(() => { getProgDefaults(db).then(r => setRange(toText(r))); }, [db]);

  const save = () => {
    const r = parseRange(range);
    if (typeof r === 'string') return Alert.alert('Check the numbers', r);
    const apply = async (all: boolean) => {
      await setProgDefaults(db, r, all);
      router.back();
      Alert.alert('Saved 🐾', all ? 'Every exercise now uses this rule.' : 'New exercises will use this rule.');
    };
    Alert.alert('Use this for which exercises?', 'All exercises replaces any per-exercise settings you made.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Only new ones', onPress: () => apply(false) },
      { text: 'All exercises', onPress: () => apply(true) },
    ]);
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ ...screenTheme(t), title: 'Progression' }} />
      <Card style={{ gap: 12 }}>
        <Txt weight="black" size={18}>Progressive overload</Txt>
        <ProgressionFields value={range} onChange={setRange} />
      </Card>
      <Btn title="Save" onPress={save} />
      <Btn variant="ghost" title="Reset to 8–12 reps, +2.5 kg" onPress={() => setRange(toText(DEFAULT_RANGE))} />
      <Txt size={12} color={t.sub} style={{ textAlign: 'center' }}>
        Want a different rule for one lift? Tap its “reps · kg” line during a workout, or tap it in the Exercises tab.
      </Txt>
    </ScrollView>
  );
}
