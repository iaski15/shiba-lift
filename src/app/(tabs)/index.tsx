import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Chart } from '../../components/Chart';
import { Shiba } from '../../components/Shiba';
import { Btn, Card, Input, Txt, kg, setText, useTheme } from '../../components/ui';
import { listWorkouts, overloadSessions, workoutSets, type SetRow, type WorkoutRow } from '../../lib/db';
import { overload, sessionKey } from '../../lib/progression';
import { supabase, useSession } from '../../lib/supabase';

type Post = {
  id: number; title: string; created_at: string; user_id: string;
  summary: { minutes: number; volume: number; sets: number; prs: number; exercises: { name: string; sets: number; best: string }[] };
  profiles: { username: string };
  likes: { user_id: string }[];
  comments: { id: number; body: string; created_at: string; profiles: { username: string } }[];
};

const ago = (iso: string) => {
  const m = Math.floor((Date.now() - +new Date(iso)) / 60000);
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
};

export default function Feed() {
  const t = useTheme();
  const session = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const uid = session?.user.id;

  const load = useCallback(async () => {
    if (!supabase || !uid) return;
    setLoading(true);
    const { data: f } = await supabase.from('follows').select('followee').eq('follower', uid);
    const ids = [uid, ...(f ?? []).map(x => x.followee)];
    const { data } = await supabase
      .from('posts')
      .select('id, title, summary, created_at, user_id, profiles!posts_user_id_fkey(username), likes(user_id), comments(id, body, created_at, profiles!comments_user_id_fkey(username))')
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .limit(50);
    setPosts((data ?? []) as unknown as Post[]);
    setLoading(false);
  }, [uid]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const signedIn = !!supabase && !!uid;
  return (
    <FlatList
      data={signedIn ? posts : []}
      keyExtractor={p => String(p.id)}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={signedIn ? <RefreshControl refreshing={loading} onRefresh={load} tintColor={t.primary} /> : undefined}
      ListHeaderComponent={<MyLifts />}
      ListEmptyComponent={!signedIn ? (
        <View style={{ alignItems: 'center', gap: 12, marginTop: 24 }}>
          <Shiba size={120} mood="sleepy" />
          <Txt weight="black" size={22}>Your pack is sleeping</Txt>
          <Txt color={t.sub} style={{ textAlign: 'center' }}>
            {supabase ? 'Sign in to follow friends, share workouts and give paws.' : 'Social is off. Add your Supabase keys to .env (see README) to enable it. Tracking works fully offline.'}
          </Txt>
          {supabase && <Btn title="Sign in / Sign up" onPress={() => router.push('/auth')} />}
        </View>
      ) : !loading ? (
        <View style={{ alignItems: 'center', gap: 8, marginTop: 40 }}>
          <Shiba size={100} />
          <Txt weight="bold">No workouts yet.</Txt>
          <Txt color={t.sub} style={{ textAlign: 'center' }}>Finish a workout or follow friends from the Me tab.</Txt>
        </View>
      ) : null}
      renderItem={({ item }) => <PostCard p={item} uid={uid!} reload={load} />}
    />
  );
}

// Your own lifts (local, works offline): overload streak, volume chart, and workouts that expand into their sets.
function MyLifts() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [ov, setOv] = useState(() => overload([]));
  const [shown, setShown] = useState(5);
  useFocusEffect(useCallback(() => {
    listWorkouts(db).then(setWorkouts);
    overloadSessions(db).then(s => setOv(overload(s)));
  }, [db]));
  if (!workouts.length) return null;

  return (
    <View style={{ gap: 12, marginBottom: 4 }}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Shiba size={64} mood={ov.current ? 'hype' : 'sleepy'} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt weight="black" size={22} color={t.primaryDark}>🔥 {ov.current} workout{ov.current === 1 ? '' : 's'}</Txt>
          <Txt weight="bold" size={13}>Progressive overload streak · best {ov.best}</Txt>
          <Txt size={12} color={t.sub}>Workouts in a row where you beat last time on at least one exercise: more weight, or more reps at your top weight.</Txt>
        </View>
      </Card>
      <Card style={{ gap: 8 }}>
        <Txt weight="black">Weight lifted per workout</Txt>
        <Chart points={workouts.slice(0, 20).reverse().map(w => ({ t: w.started_at, y: w.volume }))} fmt={kg} />
      </Card>
      <Txt weight="black" size={18}>My workouts</Txt>
      {workouts.slice(0, shown).map(w => <WorkoutCard key={w.id} w={w} up={ov.up} streak={ov.byWorkout.get(w.id)} />)}
      {shown < workouts.length && <Btn small variant="ghost" title="Show more" onPress={() => setShown(shown + 10)} />}
      <Txt weight="black" size={18} style={{ marginTop: 8 }}>🐾 Pack</Txt>
    </View>
  );
}

function WorkoutCard({ w, up, streak }: { w: WorkoutRow; up: Set<string>; streak?: boolean }) {
  const db = useSQLiteContext();
  const t = useTheme();
  const [sets, setSets] = useState<SetRow[] | null>(null);
  const toggle = async () => setSets(sets ? null : await workoutSets(db, w.id));
  const byEx = new Map<string, SetRow[]>();
  for (const s of sets ?? []) byEx.set(s.exercise_id, [...(byEx.get(s.exercise_id) ?? []), s]);

  return (
    <Card style={{ gap: 8 }}>
      <Pressable onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded: !!sets }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Txt weight="bold">{w.name}{streak ? ' 🔥' : ''}</Txt>
          <Txt size={12} color={t.sub}>
            {new Date(w.started_at).toLocaleDateString()} · {Math.round((w.ended_at - w.started_at) / 60000)} min · {w.sets} set{w.sets === 1 ? '' : 's'} · {kg(w.volume)}
          </Txt>
        </View>
        <Txt weight="black" color={t.primary} size={18}>{sets ? '▾' : '▸'}</Txt>
      </Pressable>
      {[...byEx].map(([id, ss]) => (
        <Pressable key={id} onPress={() => router.push({ pathname: '/exercise', params: { id } })} accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderColor: t.line, paddingTop: 8 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt weight="bold">{ss[0].name}{up.has(sessionKey(ss[0])) && <Txt weight="bold" color={t.good}> ▲ beat last time</Txt>}</Txt>
            <Txt size={13} color={t.sub}>{ss.map(setText).join(' · ')}</Txt>
          </View>
          <Txt weight="black" color={t.primary} size={18}>›</Txt>
        </Pressable>
      ))}
    </Card>
  );
}

function PostCard({ p, uid, reload }: { p: Post; uid: string; reload: () => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const liked = p.likes.some(l => l.user_id === uid);

  const like = async () => {
    if (liked) await supabase!.from('likes').delete().eq('post_id', p.id).eq('user_id', uid);
    else await supabase!.from('likes').insert({ post_id: p.id });
    reload();
  };
  const comment = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    await supabase!.from('comments').insert({ post_id: p.id, body: body.slice(0, 500) });
    reload();
  };

  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Shiba size={40} mood={p.summary.prs ? 'hype' : 'happy'} />
        <View style={{ flex: 1 }}>
          <Txt weight="black">{p.profiles?.username}</Txt>
          <Txt size={12} color={t.sub}>{ago(p.created_at)}</Txt>
        </View>
      </View>
      <Txt weight="black" size={18}>{p.title}</Txt>
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
        <Txt size={13} color={t.sub}>⏱ {p.summary.minutes} min</Txt>
        <Txt size={13} color={t.sub}>🏋️ {kg(p.summary.volume)}</Txt>
        <Txt size={13} color={t.sub}>{p.summary.sets} sets</Txt>
        {p.summary.prs > 0 && <Txt size={13} weight="bold" color={t.primaryDark}>🏆 {p.summary.prs} PR{p.summary.prs > 1 ? 's' : ''}</Txt>}
      </View>
      <View style={{ gap: 2 }}>
        {p.summary.exercises.map((e, i) => (
          <Txt key={i} size={14}>{e.sets} × {e.name} <Txt size={13} color={t.sub}>· best {e.best}</Txt></Txt>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 18, borderTopWidth: 1, borderColor: t.line, paddingTop: 8 }}>
        <Pressable onPress={like} accessibilityRole="button" accessibilityLabel={liked ? 'Remove paw' : 'Give paw'}>
          <Txt weight="bold" color={liked ? t.primaryDark : t.sub}>{liked ? '🐾' : '🤍'} {p.likes.length}</Txt>
        </Pressable>
        <Pressable onPress={() => setOpen(!open)} accessibilityRole="button">
          <Txt weight="bold" color={t.sub}>💬 {p.comments.length}</Txt>
        </Pressable>
      </View>
      {open && (
        <View style={{ gap: 6 }}>
          {[...p.comments].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(c => (
            <Txt key={c.id} size={14}><Txt weight="bold" size={14}>{c.profiles?.username} </Txt>{c.body}</Txt>
          ))}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Input placeholder="Say something nice…" value={text} onChangeText={setText} style={{ flex: 1 }} maxLength={500} onSubmitEditing={comment} />
            <Btn small title="Send" onPress={comment} />
          </View>
        </View>
      )}
    </Card>
  );
}
