import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Shiba } from '../components/Shiba';
import { Btn, Card, Txt, useTheme } from '../components/ui';

// Heaviest thing you out-lifted wins. Weights are rough on purpose.
const THINGS: [kg: number, emoji: string, one: string, many: string][] = [
  [10, '🐕', 'Shiba Inu', 'Shiba Inus'],
  [200, '🏍️', 'motorcycle', 'motorcycles'],
  [450, '🎹', 'grand piano', 'grand pianos'],
  [1500, '🚗', 'car', 'cars'],
  [6000, '🐘', 'elephant', 'elephants'],
  [8000, '🦖', 'T-rex', 'T-rexes'],
  [150000, '🐋', 'blue whale', 'blue whales'],
];

function funFact(volume: number) {
  const [kg, emoji, one, many] = [...THINGS].reverse().find(([kg]) => volume >= kg) ?? THINGS[0];
  const n = volume / kg;
  const nice = n >= 10 ? Math.round(n).toLocaleString() : String(Math.round(n * 10) / 10);
  return `${emoji} That's about ${nice} ${n === 1 ? one : many}!`;
}

export default function Summary() {
  const t = useTheme();
  const p = useLocalSearchParams<{ name: string; minutes: string; volume: string; sets: string; prs: string; shared: string }>();
  const volume = Number(p.volume) || 0, prs = Number(p.prs) || 0;
  const stat = (value: string, label: string) => (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 12 }}>
      <Txt weight="black" size={22} color={t.primaryDark}>{value}</Txt>
      <Txt size={12} color={t.sub}>{label}</Txt>
    </Card>
  );
  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 14, alignItems: 'stretch' }}>
      <View style={{ alignItems: 'center' }}><Shiba size={140} mood="hype" /></View>
      <Txt weight="black" size={26} style={{ textAlign: 'center' }}>{p.name || 'Workout'} done! 🐾</Txt>
      <Card style={{ alignItems: 'center', gap: 4, paddingVertical: 22 }}>
        <Txt weight="bold" color={t.sub}>Total weight lifted</Txt>
        <Txt weight="black" size={44} color={t.primary}>{Math.round(volume).toLocaleString()} kg</Txt>
        <Txt weight="bold" size={16} style={{ textAlign: 'center' }}>{volume > 0 ? funFact(volume) : 'Bodyweight day. Still counts!'}</Txt>
      </Card>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {stat(`${p.minutes ?? 0} min`, 'duration')}
        {stat(String(p.sets ?? 0), 'sets')}
        {stat(prs ? `🏆 ${prs}` : '0', prs === 1 ? 'PR' : 'PRs')}
      </View>
      {p.shared === '1' && <Txt color={t.sub} style={{ textAlign: 'center' }}>Shared with your pack.</Txt>}
      <Btn title="Good dog 🐕" onPress={() => router.back()} />
    </ScrollView>
  );
}
