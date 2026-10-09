import { Nunito_400Regular, Nunito_700Bold, Nunito_900Black, useFonts } from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { autoSyncHevy } from '../components/HevyCard';
import { StatusBar } from 'expo-status-bar';
import { font, useTheme } from '../components/ui';
import { migrate } from '../lib/db';

export default function Root() {
  const t = useTheme();
  const [loaded] = useFonts({ Nunito_400Regular, Nunito_700Bold, Nunito_900Black });
  if (!loaded) return null;
  return (
    <SQLiteProvider databaseName="shiba.db" onInit={migrate}>
      <StatusBar style="auto" />
      <HevyAutoSync />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.primaryDark,
          headerTitleStyle: { fontFamily: font.black, color: t.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="active" options={{ title: 'Workout', gestureEnabled: false }} />
        <Stack.Screen name="auth" options={{ title: 'Join the pack', presentation: 'modal' }} />
        <Stack.Screen name="summary" options={{ title: 'Workout complete', headerBackVisible: false }} />
        <Stack.Screen name="routine" options={{ title: 'Routine' }} />
        <Stack.Screen name="settings" options={{ title: 'Progression' }} />
      </Stack>
    </SQLiteProvider>
  );
}

function HevyAutoSync() {
  const db = useSQLiteContext();
  useEffect(() => { autoSyncHevy(db); }, [db]);
  return null;
}
