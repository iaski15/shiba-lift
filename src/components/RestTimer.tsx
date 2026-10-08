import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Shiba } from './Shiba';
import { Txt, useTheme } from './ui';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

let asked = false;
async function ensurePermission() {
  if (asked) return;
  asked = true;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('rest', { name: 'Rest timer', importance: Notifications.AndroidImportance.HIGH });
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') await Notifications.requestPermissionsAsync();
}

// Owns the countdown + background notification. Parent just sets `endAt` (ms timestamp) or null.
export function RestTimer({ endAt, setEndAt }: { endAt: number | null; setEndAt: (n: number | null) => void }) {
  const t = useTheme();
  const [now, setNow] = useState(() => Date.now());
  const notifId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (notifId.current) await Notifications.cancelScheduledNotificationAsync(notifId.current);
      notifId.current = null;
      if (!endAt) return;
      await ensurePermission();
      const seconds = Math.round((endAt - Date.now()) / 1000);
      if (cancelled || seconds < 1) return;
      notifId.current = await Notifications.scheduleNotificationAsync({
        content: { title: 'Rest over! 🐕', body: 'Shiba says: next set, go go go' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: 'rest' },
      });
    })();
    if (!endAt) return;
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => { cancelled = true; clearInterval(iv); };
  }, [endAt]);

  const left = endAt ? Math.ceil((endAt - now) / 1000) : 0;
  useEffect(() => {
    if (endAt && left <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setEndAt(null);
    }
  }, [left, endAt, setEndAt]);

  if (!endAt || left <= 0) return null;
  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.primary, borderRadius: 26, padding: 10, paddingHorizontal: 14 }}>
      <Shiba size={40} mood="sleepy" />
      <View style={{ flex: 1 }}>
        <Txt weight="bold" size={12} color="#fff">Resting…</Txt>
        <Txt weight="black" size={24} color="#fff">{mm}:{ss}</Txt>
      </View>
      <Chip title="−15" onPress={() => setEndAt(endAt - 15000)} />
      <Chip title="+15" onPress={() => setEndAt(endAt + 15000)} />
      <Chip title="Skip" onPress={() => setEndAt(null)} />
    </View>
  );
}

const Chip = ({ title, onPress }: { title: string; onPress: () => void }) => (
  <Pressable accessibilityRole="button" onPress={onPress} style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 }}>
    <Txt weight="black" size={13} color="#fff">{title}</Txt>
  </Pressable>
);
