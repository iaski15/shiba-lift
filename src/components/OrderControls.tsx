import { Pressable, View } from 'react-native';
import { detach, groupBounds, inGroup, moveGroup, pair, type Linkable } from '../lib/superset';
import { Txt, useTheme } from './ui';

type Props<T extends Linkable> = {
  items: T[];
  index: number;
  pairFrom: number | null; // index whose "Superset" was tapped; the next "Pair" tap joins that exercise
  setPairFrom: (i: number | null) => void;
  onChange: (items: T[]) => void;
};

// ↑ ↓ to reorder (a superset moves as one), "Superset" → then "Pair" on any other exercise, "Unlink" to split off.
export function OrderControls<T extends Linkable>({ items, index, pairFrom, setPairFrom, onChange }: Props<T>) {
  const t = useTheme();
  const [s, e] = groupBounds(items, index);
  const chip = (label: string, onPress: () => void, opts: { on?: boolean; disabled?: boolean; a11y?: string } = {}) => (
    <Pressable key={label} hitSlop={6} disabled={opts.disabled} onPress={onPress} accessibilityRole="button" accessibilityLabel={opts.a11y ?? label}
      style={{ backgroundColor: opts.on ? t.superset : t.line, opacity: opts.disabled ? 0.35 : 1, borderRadius: 999, minWidth: 36, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5 }}>
      <Txt weight="black" size={12} color={opts.on ? '#fff' : t.text}>{label}</Txt>
    </Pressable>
  );

  if (pairFrom !== null) {
    const [ps, pe] = groupBounds(items, pairFrom);
    if (index >= ps && index <= pe) {
      return <View style={{ flexDirection: 'row' }}>{index === pairFrom && chip('Cancel', () => setPairFrom(null))}</View>;
    }
    return (
      <View style={{ flexDirection: 'row' }}>
        {chip('🔗 Pair with this', () => { onChange(pair(items, pairFrom, index)); setPairFrom(null); }, { on: true })}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {chip('↑', () => onChange(moveGroup(items, index, -1)), { disabled: s === 0, a11y: 'Move up' })}
      {chip('↓', () => onChange(moveGroup(items, index, 1)), { disabled: e === items.length - 1, a11y: 'Move down' })}
      {inGroup(items, index)
        ? chip('Unlink', () => onChange(detach(items, index)), { a11y: 'Remove from superset' })
        : items.length > 1 && chip('🔗 Superset', () => setPairFrom(index))}
    </View>
  );
}

export function PairBanner({ name, onCancel }: { name: string; onCancel: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onCancel} style={{ backgroundColor: t.superset, borderRadius: 16, padding: 12 }}>
      <Txt weight="black" color="#fff">🔗 Pick the exercise to superset with {name}</Txt>
      <Txt size={12} color="#fff">Tap “Pair with this” on it. Tap here to cancel.</Txt>
    </Pressable>
  );
}
