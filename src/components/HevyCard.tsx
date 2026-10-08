import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { getKv, setKv } from '../lib/db';
import { hevyGet, syncHevy, type HevyUser } from '../lib/hevy';
import { Btn, Card, Input, Txt, useTheme } from './ui';

const KEY = 'hevy_api_key';

// One sync at a time (launch auto-sync and the button share it).
let running: ReturnType<typeof syncHevy> | null = null;
const sync = (db: SQLiteDatabase, key: string, onProgress?: (m: string) => void) =>
  (running ??= syncHevy(db, key, onProgress).finally(() => { running = null; }));

// Called once on app launch: quietly pull anything new from Hevy.
export async function autoSyncHevy(db: SQLiteDatabase) {
  const key = await SecureStore.getItemAsync(KEY);
  if (key) await sync(db, key).catch(() => {}); // offline / key revoked: the Me tab shows errors when synced by hand
}

async function loadState(db: SQLiteDatabase) {
  const [u, s, key] = await Promise.all([getKv(db, 'hevy_user'), getKv(db, 'hevy_since'), SecureStore.getItemAsync(KEY)]);
  return { user: u && key ? (JSON.parse(u) as HevyUser) : null, since: s };
}

export function HevyCard({ onSynced }: { onSynced: () => void }) {
  const db = useSQLiteContext();
  const t = useTheme();
  const [user, setUser] = useState<HevyUser | null>(null);
  const [since, setSince] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => loadState(db).then(s => { setUser(s.user); setSince(s.since); });
  useEffect(() => { loadState(db).then(s => { setUser(s.user); setSince(s.since); }); }, [db]);

  const run = async (key: string) => {
    setBusy('Syncing…');
    try {
      const r = await sync(db, key, setBusy);
      onSynced();
      await refresh();
      const changes = r.workouts || r.deleted || r.backfilled
        ? [r.workouts && `${r.workouts} workouts updated (${r.sets} sets)`, r.backfilled && `${r.backfilled} missing workouts added`,
          r.deleted && `${r.deleted} deleted`, r.newExercises && `${r.newExercises} new exercises`].filter(Boolean).join(' · ')
        : 'Already up to date.';
      // Hevy's count can include workouts its list never returns, so judge completeness by the list when we fetched it.
      const total = r.listed ?? r.hevyTotal;
      const status = r.synced >= total ? `All ${r.synced} Hevy workouts are in Shiba Lift.`
        : `${r.synced} of ${total} Hevy workouts are in Shiba Lift${r.badDate ? ` (${r.badDate} had an unreadable date)` : ''}.`;
      Alert.alert('Synced with Hevy 🐾', `${changes}

${status}`);
    } catch (e) {
      Alert.alert('Hevy sync failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    const key = keyInput.trim();
    if (!key) return;
    setBusy('Checking key…');
    try {
      const { data } = await hevyGet<{ data: HevyUser }>('/user/info', key);
      await SecureStore.setItemAsync(KEY, key);
      await setKv(db, 'hevy_user', JSON.stringify({ username: data.username, name: data.name }));
      setKeyInput('');
      await refresh();
    } catch (e) {
      setBusy(null);
      return Alert.alert('Could not connect', e instanceof Error ? e.message : String(e));
    }
    await run(key);
  };

  const disconnect = () => Alert.alert('Disconnect Hevy?', 'Your synced workouts stay in Shiba Lift.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Disconnect', style: 'destructive', onPress: async () => {
      await SecureStore.deleteItemAsync(KEY);
      await setKv(db, 'hevy_user', null);
      await setKv(db, 'hevy_since', null);
      await refresh();
    } },
  ]);

  if (!user) {
    return (
      <Card style={{ gap: 8 }}>
        <Txt weight="black" size={16}>🔗 Connect Hevy (Pro)</Txt>
        <Txt size={13} color={t.sub}>Get your API key at hevy.com/settings?developer, then paste it here. Your workouts sync automatically when the app opens.</Txt>
        <Input placeholder="Hevy API key" value={keyInput} onChangeText={setKeyInput} secureTextEntry autoCapitalize="none" autoCorrect={false} />
        <Btn small title={busy ?? 'Connect & sync'} disabled={!!busy || !keyInput.trim()} onPress={connect} />
      </Card>
    );
  }
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Txt weight="black" size={16}>🔗 Hevy: @{user.username}</Txt>
          <Txt size={12} color={t.sub}>{since ? `Last synced ${new Date(since).toLocaleString()}` : 'Not synced yet'}</Txt>
        </View>
        <Btn small variant="ghost" title="Disconnect" onPress={disconnect} />
      </View>
      <Btn small title={busy ?? '🔄 Sync now'} disabled={!!busy} onPress={async () => {
        const key = await SecureStore.getItemAsync(KEY);
        if (key) run(key);
      }} />
    </Card>
  );
}
