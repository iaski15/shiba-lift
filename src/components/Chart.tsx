import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Txt, useTheme } from './ui';

export type Point = { t: number; y: number };
const H = 140, PAD = 10;
const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// Single-series line chart, points evenly spaced oldest -> newest. Shows the newest point; tap the chart to read any other.
// `change` adds the difference to the first point (only meaningful when every point measures the same thing).
export function Chart({ points, fmt, change }: { points: Point[]; fmt: (y: number) => string; change?: boolean }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  if (points.length < 2) return <Txt size={13} color={t.sub}>Log it at least twice to see a chart.</Txt>;

  const ys = points.map(p => p.y), min = Math.min(...ys), max = Math.max(...ys);
  const lo = min === max ? min - 1 : min, hi = min === max ? max + 1 : max;
  const n = points.length - 1;
  const x = (i: number) => PAD + (i * (w - 2 * PAD)) / n;
  const y = (v: number) => PAD + ((hi - v) * (H - 2 * PAD)) / (hi - lo);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p.y)}`).join(' ');
  const i = sel !== null && sel <= n ? sel : n, p = points[i], diff = p.y - points[0].y;

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Txt weight="black" size={20}>{fmt(p.y)}</Txt>
        <Txt size={12} color={t.sub} style={{ flex: 1 }}>{day(p.t)}{i === n ? ' · latest' : ''}</Txt>
        {change && i > 0 && diff !== 0 && <Txt size={12} weight="bold" color={diff > 0 ? t.good : t.danger}>{diff > 0 ? '▲ +' : '▼ −'}{fmt(Math.abs(diff))} since first</Txt>}
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <View style={{ height: H, justifyContent: 'space-between', paddingVertical: PAD - 7 }}>
          <Txt size={11} color={t.sub}>{fmt(max)}</Txt>
          <Txt size={11} color={t.sub}>{fmt(min)}</Txt>
        </View>
        <Pressable
          style={{ flex: 1, height: H }}
          onLayout={e => setW(e.nativeEvent.layout.width)}
          onPress={e => setSel(Math.max(0, Math.min(n, Math.round(((e.nativeEvent.locationX - PAD) / (w - 2 * PAD)) * n))))}
          accessibilityLabel={`Chart, ${points.length} points from ${fmt(points[0].y)} to ${fmt(points[n].y)}. Tap to read a point.`}>
          {w > 0 && (
            <Svg width={w} height={H}>
              <Line x1={0} x2={w} y1={y(max)} y2={y(max)} stroke={t.line} />
              <Line x1={0} x2={w} y1={y(min)} y2={y(min)} stroke={t.line} />
              <Path d={`${line} L${x(n)} ${H} L${x(0)} ${H} Z`} fill={t.primary} opacity={0.12} />
              <Path d={line} stroke={t.primary} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
              <Line x1={x(i)} x2={x(i)} y1={0} y2={H} stroke={t.sub} strokeDasharray="3 3" />
              <Circle cx={x(i)} cy={y(p.y)} r={5} fill={t.primaryDark} stroke={t.card} strokeWidth={2} />
            </Svg>
          )}
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Txt size={11} color={t.sub}>{day(points[0].t)}</Txt>
        <Txt size={11} color={t.sub}>{day(points[n].t)}</Txt>
      </View>
    </View>
  );
}
