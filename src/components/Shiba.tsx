import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

const O = '#E8A35A', C = '#FFF4E6', D = '#2B2B2B', P = '#F28B82';

export function Shiba({ size = 96, mood = 'happy' }: { size?: number; mood?: 'happy' | 'sleepy' | 'hype' }) {
  const eye = (x: number) =>
    mood === 'happy' ? <Circle key={x} cx={x} cy={54} r={4.5} fill={D} />
    : mood === 'sleepy' ? <Path key={x} d={`M${x - 5} 54 Q${x} 58 ${x + 5} 54`} stroke={D} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    : <Path key={x} d={`M${x - 5} 56 Q${x} 48 ${x + 5} 56`} stroke={D} strokeWidth={3} fill="none" strokeLinecap="round" />;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M16 46 L22 8 L46 28 Z" fill={O} strokeLinejoin="round" />
      <Path d="M84 46 L78 8 L54 28 Z" fill={O} strokeLinejoin="round" />
      <Path d="M24 36 L26 16 L39 28 Z" fill={C} />
      <Path d="M76 36 L74 16 L61 28 Z" fill={C} />
      <Ellipse cx={50} cy={57} rx={38} ry={33} fill={O} />
      <Ellipse cx={50} cy={72} rx={27} ry={17} fill={C} />
      <Circle cx={37} cy={43} r={3} fill={C} />
      <Circle cx={63} cy={43} r={3} fill={C} />
      {[38, 62].map(eye)}
      <Ellipse cx={30} cy={65} rx={5} ry={3} fill={P} opacity={0.6} />
      <Ellipse cx={70} cy={65} rx={5} ry={3} fill={P} opacity={0.6} />
      <Ellipse cx={50} cy={64} rx={4.5} ry={3.2} fill={D} />
      {mood === 'hype'
        ? <Path d="M43 69 Q50 82 57 69 Z" fill={P} stroke={D} strokeWidth={2} strokeLinejoin="round" />
        : <Path d="M44 69 Q47 73 50 68 Q53 73 56 69" stroke={D} strokeWidth={2} fill="none" strokeLinecap="round" />}
    </Svg>
  );
}
