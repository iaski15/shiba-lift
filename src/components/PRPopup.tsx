import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { prLabel, type PR } from '../lib/progression';
import { Shiba } from './Shiba';
import { Btn, Txt, useTheme, kg } from './ui';

export type PRInfo = { kind: PR; exercise: string; weight: number; reps: number };

const PAWS = 10;

function Paw({ i, p }: { i: number; p: SharedValue<number> }) {
  const a = (i / PAWS) * Math.PI * 2;
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    opacity: 1 - p.value,
    transform: [{ translateX: Math.cos(a) * 140 * p.value }, { translateY: Math.sin(a) * 140 * p.value }, { scale: 0.6 + p.value }],
  }));
  return <Animated.Text style={[{ fontSize: 26 }, style]}>🐾</Animated.Text>;
}

export function PRPopup({ pr, onClose }: { pr: PRInfo | null; onClose: () => void }) {
  const t = useTheme();
  const scale = useSharedValue(0);
  const burst = useSharedValue(0);

  useEffect(() => {
    if (!pr) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scale.value = 0;
    burst.value = 0;
    scale.value = withSequence(withSpring(1.2, { damping: 6 }), withSpring(1));
    burst.value = withTiming(1, { duration: 900 });
  }, [pr, scale, burst]);

  const shibaStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { rotate: `${(1 - scale.value) * -20}deg` }] }));

  return (
    <Modal visible={!!pr} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: t.card, borderRadius: 32, padding: 28, alignItems: 'center', width: '100%', maxWidth: 360 }}>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            {Array.from({ length: PAWS }, (_, i) => <Paw key={i} i={i} p={burst} />)}
            <Animated.View style={shibaStyle}><Shiba size={130} mood="hype" /></Animated.View>
          </View>
          <Txt weight="black" size={32} color={t.primary} style={{ marginTop: 8 }}>NEW PR! 🐾</Txt>
          {pr && <>
            <Txt weight="bold" size={18} style={{ marginTop: 6, textAlign: 'center' }}>{pr.exercise}</Txt>
            <Txt weight="black" size={26} style={{ marginVertical: 6 }}>{kg(pr.weight)} × {pr.reps}</Txt>
            <Txt color={t.sub} style={{ marginBottom: 18 }}>{prLabel[pr.kind]}. Such strong, much wow.</Txt>
          </>}
          <Btn title="Bork yeah!" onPress={onClose} />
        </View>
      </Pressable>
    </Modal>
  );
}
