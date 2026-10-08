import { Nunito_400Regular, Nunito_700Bold, Nunito_900Black, useFonts } from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
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
      </Stack>
    </SQLiteProvider>
  );
}
