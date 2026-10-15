import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Directory } from 'expo-file-system';
import { Alert, ScrollView, View } from 'react-native';
import { Chart } from '../../components/Chart';
import { HevyCard } from '../../components/HevyCard';
import { Shiba } from '../../components/Shiba';
import { Btn, Card, Input, Txt, kg, useTheme } from '../../components/ui';
import { parseHevy } from '../../lib/csv';
import { exportAll, parseBackup, restoreAll } from '../../lib/backup';
import { SCHEMA, importWorkouts, listBodyweight, listWorkouts, logBodyweight, num, personalRecords, totals, type BodyweightRow, type PRRow, type WorkoutRow } from '../../lib/db';
import { supabase, useSession } from '../../lib/supabase';

export default function Profile() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [prs, setPrs] = useState<PRRow[]>([]);
  const [tot, setTot] = useState({ workouts: 0, volume: 0 });
  const [importing, setImporting] = useState(false);
  const [bw, setBw] = useState<BodyweightRow[]>([]);

  const load = useCallback(() => {
    listWorkouts(db).then(setWorkouts);
    listBodyweight(db).then(setBw);
    personalRecords(db).then(setPrs);
    totals(db).then(setTot);
  }, [db]);
  useFocusEffect(load);

  const importHevy = async () => {
    const pick = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (pick.canceled) return;
    setImporting(true);
    try {
      // fetch reads the picked file:// copy; expo-file-system's File is denied READ on it in Expo Go.
      const ws = parseHevy(await (await fetch(pick.assets[0].uri)).text());
      if (!ws.length) throw new Error('No sets with reps found in that file.');
      const r = await importWorkouts(db, ws);
      load();
      Alert.alert('Imported! 🐾', `${r.workouts} workouts · ${r.sets} sets · ${r.newExercises} new exercises` +
        (r.skipped ? `
${r.skipped} already imported, skipped.` : ''));
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  // Without Hevy Pro the phone is the only copy of the history: let it go to a file (Drive, Downloads…) and come back.
  const backup = async () => {
    try {
      const dir = await Directory.pickDirectoryAsync();
      const file = dir.createFile(`shiba-lift-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
      file.write(JSON.stringify(await exportAll(db, SCHEMA)));
      Alert.alert('Backed up 🐾', `Saved ${file.name ?? 'the backup'}. Keep it somewhere safe, like Google Drive.`);
    } catch (e) {
      if (!/cancel/i.test(String(e))) Alert.alert('Backup failed', e instanceof Error ? e.message : String(e));
    }
  };
  const restore = async () => {
    const pick = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (pick.canceled) return;
    try {
      const b = parseBackup(await (await fetch(pick.assets[0].uri)).text(), SCHEMA);
      Alert.alert('Restore this backup?', `From ${new Date(b.exportedAt).toLocaleString()}: ${b.tables.workouts.length} workouts. It replaces everything on this phone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', style: 'destructive', onPress: async () => {
          try { await restoreAll(db, b); load(); Alert.alert('Restored 🐾', 'Your history is back.'); }
          catch (e) { Alert.alert('Restore failed', `Nothing was changed. ${e instanceof Error ? e.message : String(e)}`); }
        } },
      ]);
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Social />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Txt weight="black" size={26} color={t.primaryDark}>{tot.workouts}</Txt>
          <Txt size={12} color={t.sub}>workouts</Txt>
        </Card>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Txt weight="black" size={26} color={t.primaryDark}>{(tot.volume / 1000).toFixed(tot.volume >= 100000 ? 0 : 1)}t</Txt>
          <Txt size={12} color={t.sub}>total lifted</Txt>
        </Card>
      </View>

      <Btn variant="ghost" title="⚙️ Progression settings" onPress={() => router.push('/settings')} />
      <HevyCard onSynced={load} />
      <Btn variant="ghost" title={importing ? 'Importing…' : '📥 Import Hevy workouts (CSV)'} disabled={importing} onPress={importHevy} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Btn small variant="ghost" title="💾 Back up to file" onPress={backup} /></View>
        <View style={{ flex: 1 }}><Btn small variant="ghost" title="♻️ Restore backup" onPress={restore} /></View>
      </View>

      <Bodyweight rows={bw} onLogged={load} />

      <Txt weight="black" size={18}>🏆 Personal records</Txt>
      <Card style={{ gap: 6 }}>
        {prs.length === 0 && <Txt color={t.sub}>Log some sets and your PRs show up here.</Txt>}
        {prs.slice(0, 15).map(p => (
          <View key={p.name} style={{ flexDirection: 'row', gap: 8 }}>
            <Txt style={{ flex: 1 }} numberOfLines={1}>{p.name}</Txt>
            <Txt weight="bold">{kg(p.weight)}</Txt>
            <Txt size={12} color={t.sub} style={{ width: 90, textAlign: 'right' }}>{p.best ? `e1RM ${kg(Math.round(p.best * 2) / 2)}` : ''}</Txt>
          </View>
        ))}
      </Card>

      <Txt weight="black" size={18}>📅 History</Txt>
      {workouts.length === 0 && <Txt color={t.sub}>No workouts yet. Go lift something!</Txt>}
      {workouts.map(w => (
        <Card key={w.id}>
          <Txt weight="bold">{w.name}</Txt>
          <Txt size={12} color={t.sub}>
            {new Date(w.started_at).toLocaleString()} · {Math.round((w.ended_at - w.started_at) / 60000)} min · {w.sets} set{w.sets === 1 ? '' : 's'} · {kg(w.volume)}
          </Txt>
        </Card>
      ))}
    </ScrollView>
  );
}

function Bodyweight({ rows, onLogged }: { rows: BodyweightRow[]; onLogged: () => void }) {
  const db = useSQLiteContext();
  const [text, setText] = useState('');
  const log = async () => {
    const v = num(text);
    if (v === undefined || !(v >= 20 && v <= 400)) return Alert.alert('Hmm 🐕', 'Enter your bodyweight in kg, e.g. 78.5.');
    await logBodyweight(db, v);
    setText('');
    onLogged();
  };
  return (
    <Card style={{ gap: 10 }}>
      <Txt weight="black" size={18}>⚖️ Bodyweight</Txt>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Input style={{ flex: 1 }} keyboardType="decimal-pad" placeholder={rows.length ? `Last: ${rows[rows.length - 1].kg} kg` : 'Today’s weight (kg)'}
          value={text} onChangeText={setText} onSubmitEditing={log} />
        <Btn small title="Log" onPress={log} />
      </View>
      {rows.length > 0 && <Chart points={rows.slice(-60).map(r => ({ t: r.at, y: r.kg }))} fmt={kg} change />}
    </Card>
  );
}

type User = { id: string; username: string };

function Social() {
  const t = useTheme();
  const session = useSession();
  const uid = session?.user.id;
  const [me, setMe] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);

  const loadFollowing = useCallback(async () => {
    if (!supabase || !uid) return;
    const { data: p } = await supabase.from('profiles').select('username').eq('id', uid).single();
    setMe(p?.username ?? '');
    const { data } = await supabase.from('follows').select('profiles!follows_followee_fkey(id, username)').eq('follower', uid);
    setFollowing((data ?? []).map((r: any) => r.profiles));
  }, [uid]);
  useFocusEffect(useCallback(() => { loadFollowing(); }, [loadFollowing]));

  useEffect(() => {
    if (!supabase || !uid || q.trim().length < 2) return;
    const h = setTimeout(async () => {
      const safe = q.trim().replace(/[%_\\]/g, m => '\\' + m);
      const { data } = await supabase!.from('profiles').select('id, username').ilike('username', `%${safe}%`).neq('id', uid).limit(10);
      setResults(data ?? []);
    }, 300);
    return () => clearTimeout(h);
  }, [q, uid]);

  if (!supabase) return null;
  if (!uid) {
    return (
      <Card style={{ alignItems: 'center', gap: 8 }}>
        <Shiba size={70} />
        <Txt weight="bold">Join the pack to share workouts</Txt>
        <Btn small title="Sign in / Sign up" onPress={() => router.push('/auth')} />
      </Card>
    );
  }

  const isFollowing = (id: string) => following.some(f => f.id === id);
  const toggle = async (u: User) => {
    if (isFollowing(u.id)) await supabase!.from('follows').delete().eq('follower', uid).eq('followee', u.id);
    else await supabase!.from('follows').insert({ followee: u.id });
    loadFollowing();
  };
  const row = (u: User) => (
    <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Shiba size={30} />
      <Txt weight="bold" style={{ flex: 1 }}>{u.username}</Txt>
      <Btn small variant={isFollowing(u.id) ? 'ghost' : 'primary'} title={isFollowing(u.id) ? 'Following' : 'Follow'} onPress={() => toggle(u)} />
    </View>
  );

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Shiba size={56} mood="hype" />
        <View style={{ flex: 1 }}>
          <Txt weight="black" size={20}>{me}</Txt>
          <Txt size={12} color={t.sub}>{following.length} following</Txt>
        </View>
        <Btn small variant="ghost" title="Sign out" onPress={() => supabase!.auth.signOut()} />
      </View>
      <Input placeholder="Find friends by username…" value={q} onChangeText={setQ} autoCapitalize="none" />
      {q.trim().length < 2 ? following.map(row) : results.map(row)}
    </Card>
  );
}
