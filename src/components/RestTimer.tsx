import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Shiba } from './Shiba';
import { Txt, useTheme } from './ui';

// Expo Go on Android throws on importing expo-notifications (SDK 53+). There the timer is in-app only;
// a development build gets the background "rest over" notification too.
let Notifications: typeof import('expo-notifications') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- must be a guarded runtime require
  Notifications = require('expo-notifications');
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
} catch {
  Notifications = null;
}

const CHANNEL = 'rest-soft';
const NOTIF_ID = 'rest-over';

let asked = false;
async function ensurePermission(Notifications: typeof import('expo-notifications')) {
  if (asked) return;
  asked = true;
  if (Platform.OS === 'android') {
    // Android fixes a channel's sound when it's created, so the soft chime needs a new channel id; drop the old loud one.
    await Notifications.deleteNotificationChannelAsync('rest').catch(() => {});
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Rest timer', importance: Notifications.AndroidImportance.HIGH, sound: 'rest.wav', vibrationPattern: [0, 120],
    });
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') await Notifications.requestPermissionsAsync();
}

export const cancelRestNotification = () => { Notifications?.cancelScheduledNotificationAsync(NOTIF_ID).catch(() => {}); };

// Owns the countdown + background notification. Parent just sets `endAt` (ms timestamp) or null.
export function RestTimer({ endAt, setEndAt }: { endAt: number | null; setEndAt: (n: number | null) => void }) {
  const t = useTheme();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!Notifications) return;
      // One fixed id: rescheduling replaces the pending one, even across screen remounts or app restarts.
      await Notifications.cancelScheduledNotificationAsync(NOTIF_ID);
      if (!endAt) return;
      await ensurePermission(Notifications);
      const seconds = Math.round((endAt - Date.now()) / 1000);
      if (cancelled || seconds < 1) return;
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIF_ID,
        content: { title: 'Rest over! 🐕', body: 'Shiba says: next set, go go go', sound: 'rest.wav' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: CHANNEL },
      });
    })();
    if (!endAt) return;
    // Refresh `now` right away: it was last set when the previous timer ran, so the first frame would show too much rest.
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const iv = setInterval(tick, 250);
    return () => { cancelled = true; clearTimeout(first); clearInterval(iv); };
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
