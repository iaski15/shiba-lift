import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from "react-native";
import { Shiba } from '../components/Shiba';
import { Btn, Input, Txt, useTheme } from '../components/ui';
import { supabase } from '../lib/supabase';

export default function Auth() {
  const t = useTheme();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!supabase) return;
    if (mode === 'up' && !/^[a-zA-Z0-9_.]{2,24}$/.test(username)) {
      return Alert.alert('Username', '2–24 letters, numbers, _ or .');
    }
    setBusy(true);
    const { data, error } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { username } } });
    setBusy(false);
    if (error) return Alert.alert('Ruh-roh', error.message);
    if (!data.session) return Alert.alert('Check your email', 'Confirm your address, then sign in.');
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 12, alignItems: 'stretch' }} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: "center" }}><Shiba size={110} mood="happy" /></View>
      <Txt weight="black" size={26} style={{ textAlign: 'center' }}>{mode === 'in' ? 'Welcome back!' : 'Join the pack'}</Txt>
      {mode === 'up' && <Input placeholder="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />}
      <Input placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
      <Btn title={busy ? '…' : mode === 'in' ? 'Sign in' : 'Create account'} disabled={busy} onPress={submit} />
      <Btn variant="ghost" title={mode === 'in' ? 'New here? Sign up' : 'Have an account? Sign in'} onPress={() => setMode(mode === 'in' ? 'up' : 'in')} />
      <Txt size={12} color={t.sub} style={{ textAlign: 'center' }}>Your workouts stay on your phone. Only finished workout summaries are shared, and other signed-in users can see them.</Txt>
    </ScrollView>
  );
}
