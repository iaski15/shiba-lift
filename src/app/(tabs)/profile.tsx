import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Shiba } from '../../components/Shiba';
import { Btn, Card, Input, Txt, kg, useTheme } from '../../components/ui';
import { listWorkouts, personalRecords, type PRRow, type WorkoutRow } from '../../lib/db';
import { supabase, useSession } from '../../lib/supabase';

export default function Profile() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [prs, setPrs] = useState<PRRow[]>([]);

  useFocusEffect(useCallback(() => {
    listWorkouts(db).then(setWorkouts);
    personalRecords(db).then(setPrs);
  }, [db]));

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Social />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Txt weight="black" size={26} color={t.primaryDark}>{workouts.length}</Txt>
          <Txt size={12} color={t.sub}>workouts</Txt>
        </Card>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Txt weight="black" size={26} color={t.primaryDark}>{(workouts.reduce((a, w) => a + w.volume, 0) / 1000).toFixed(1)}t</Txt>
          <Txt size={12} color={t.sub}>total lifted</Txt>
        </Card>
      </View>

      <Txt weight="black" size={18}>🏆 Personal records</Txt>
      <Card style={{ gap: 6 }}>
        {prs.length === 0 && <Txt color={t.sub}>Log some sets and your PRs show up here.</Txt>}
        {prs.slice(0, 15).map(p => (
          <View key={p.name} style={{ flexDirection: 'row', gap: 8 }}>
            <Txt style={{ flex: 1 }} numberOfLines={1}>{p.name}</Txt>
            <Txt weight="bold">{kg(p.weight)}</Txt>
            <Txt size={12} color={t.sub} style={{ width: 90, textAlign: 'right' }}>e1RM {kg(p.best)}</Txt>
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
