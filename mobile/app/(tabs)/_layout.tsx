import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: THEME.colors.bg,
          borderBottomWidth: 1,
          borderBottomColor: THEME.colors.border,
        },
        headerTitleStyle: {
          fontFamily: THEME.fonts.mono,
          fontSize: 13,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
        },
        headerTintColor: THEME.colors.text,
        tabBarStyle: {
          backgroundColor: THEME.colors.bg,
          borderTopWidth: 1,
          borderTopColor: THEME.colors.border,
        },
        tabBarLabelStyle: {
          fontFamily: THEME.fonts.mono,
          fontSize: 10,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        },
        tabBarActiveTintColor: THEME.colors.accent,
        tabBarInactiveTintColor: THEME.colors.textDim,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Архив',
          headerTitle: 'KEEPMEMORY // АРХИВ',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="folder-open-outline"
              size={size}
              color={color == null ? undefined : String(color)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Новый день',
          headerTitle: 'REC // НОВЫЙ ДЕНЬ',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="add-sharp"
              size={size}
              color={color == null ? undefined : String(color)}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          headerTitle: 'ID // ПРОФИЛЬ',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="person-outline"
              size={size}
              color={color == null ? undefined : String(color)}
            />
          ),
        }}
      />
    </Tabs>
  );
}