import { Pressable, Text, TextInput, View, useColorScheme, type TextInputProps, type TextProps, type ViewProps } from 'react-native';

const light = {
  bg: '#FFF4E6', card: '#FFFFFF', text: '#2B2B2B', sub: '#8A7B6B', line: '#F0E2CF',
  primary: '#E8A35A', primaryDark: '#C97F35', cream: '#FFF4E6', good: '#6BBF59', danger: '#E06B5A', input: '#FFF9F1', superset: '#8E7CC3',
};
const dark: typeof light = {
  bg: '#1E1A17', card: '#2B2622', text: '#FFF4E6', sub: '#B8A898', line: '#3A332D',
  primary: '#E8A35A', primaryDark: '#C97F35', cream: '#FFF4E6', good: '#6BBF59', danger: '#E06B5A', input: '#352F2A', superset: '#A693D9',
};
export type Theme = typeof light;
export const useTheme = () => (useColorScheme() === 'dark' ? dark : light);

export const font = { reg: 'Nunito_400Regular', bold: 'Nunito_700Bold', black: 'Nunito_900Black' };

type TxtProps = TextProps & { size?: number; weight?: keyof typeof font; color?: string };
export function Txt({ size = 15, weight = 'reg', color, style, ...p }: TxtProps) {
  const t = useTheme();
  return <Text {...p} style={[{ fontFamily: font[weight], fontSize: size, color: color ?? t.text }, style]} />;
}

type BtnProps = { title: string; onPress: () => void; variant?: 'primary' | 'ghost' | 'danger'; small?: boolean; disabled?: boolean };
export function Btn({ title, onPress, variant = 'primary', small, disabled }: BtnProps) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.primary : variant === 'danger' ? t.danger : 'transparent';
  const fg = variant === 'ghost' ? t.primaryDark : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }],
        paddingVertical: small ? 8 : 14, paddingHorizontal: small ? 14 : 20, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
        borderWidth: variant === 'ghost' ? 2 : 0, borderColor: t.primary,
      })}>
      <Txt weight="black" size={small ? 13 : 16} color={fg}>{title}</Txt>
    </Pressable>
  );
}

export function Card({ style, ...p }: ViewProps) {
  const t = useTheme();
  return <View {...p} style={[{ backgroundColor: t.card, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: t.line }, style]} />;
}

export function Input({ style, ...p }: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.sub}
      {...p}
      style={[{ backgroundColor: t.input, color: t.text, fontFamily: font.bold, fontSize: 15, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: t.line }, style]}
    />
  );
}

export const kg = (n: number) => (n >= 1000 ? `${Math.round(n).toLocaleString()} kg` : `${Math.round(n * 10) / 10} kg`);

// Stack screens re-apply these themselves: the root Stack's options don't follow a live light/dark switch.
export const screenTheme = (t: Theme) => ({
  headerStyle: { backgroundColor: t.bg },
  headerTintColor: t.primaryDark,
  headerTitleStyle: { fontFamily: font.black, color: t.text },
  contentStyle: { backgroundColor: t.bg },
});
