import { View } from 'react-native';
import type { Range } from '../lib/progression';
import { Input, Txt, useTheme } from './ui';

export type RangeText = { rep_min: string; rep_max: string; increment: string };
export const toText = (r: Range): RangeText => ({ rep_min: String(r.rep_min), rep_max: String(r.rep_max), increment: String(r.increment) });

// The three progressive-overload knobs, worded as the rule they create.
export function ProgressionFields({ value, onChange }: { value: RangeText; onChange: (v: RangeText) => void }) {
  const t = useTheme();
  const set = (k: keyof RangeText) => (v: string) => onChange({ ...value, [k]: v });
  const field = (k: keyof RangeText, decimal = false) => (
    <Input keyboardType={decimal ? 'decimal-pad' : 'number-pad'} value={value[k]} onChangeText={set(k)} selectTextOnFocus
      style={{ width: 72, textAlign: 'center' }} accessibilityLabel={k} />
  );
  const row = (before: string, input: React.ReactNode, after: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Txt weight="bold" style={{ flex: 1 }}>{before}</Txt>
      {input}
      <Txt weight="bold" style={{ width: 44 }}>{after}</Txt>
    </View>
  );
  const max = value.rep_max || '12', min = value.rep_min || '8', inc = value.increment || '2.5';
  return (
    <View style={{ gap: 10 }}>
      {row('Go up in weight when every set hits', field('rep_max'), 'reps')}
      {row('Then start again at', field('rep_min'), 'reps')}
      {row('Weight to add each time', field('increment', true), 'kg')}
      <Txt size={12} color={t.sub}>
        Example: all sets at {max} reps → next time +{inc} kg, back to {min} reps. Otherwise Shiba suggests +1 rep per set.
        {min === max ? ' (Same number twice = straight sets, e.g. 5×5: add weight every time you get all 5s.)' : ''}
      </Txt>
    </View>
  );
}
