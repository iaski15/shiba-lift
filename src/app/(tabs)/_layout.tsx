import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { font, useTheme } from '../../components/ui';

function icon(e: string) {
  return function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{e}</Text>;
  };
}

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTitleStyle: { fontFamily: font.black, color: t.text, fontSize: 22 },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.line },
        tabBarActiveTintColor: t.primaryDark,
        tabBarInactiveTintColor: t.sub,
        tabBarLabelStyle: { fontFamily: font.bold },
        sceneStyle: { backgroundColor: t.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Pack', tabBarIcon: icon('🐾') }} />
      <Tabs.Screen name="workout" options={{ title: 'Workout', tabBarIcon: icon('🏋️') }} />
      <Tabs.Screen name="exercises" options={{ title: 'Exercises', tabBarIcon: icon('📚') }} />
      <Tabs.Screen name="profile" options={{ title: 'Me', tabBarIcon: icon('🐕') }} />
    </Tabs>
  );
}
