import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { THEME } from '../constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '404 // NOT FOUND' }} />
      <View style={styles.container}>
        <Text style={styles.code}>ERR // 404</Text>
        <Text style={styles.title}>Экран не найден</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>← Вернуться в архив</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: THEME.colors.bg,
    gap: 8,
  },
  code: {
    fontFamily: THEME.fonts.mono,
    fontSize: 12,
    color: THEME.colors.accent,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  link: {
    marginTop: 12,
    paddingVertical: 10,
  },
  linkText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 13,
    color: THEME.colors.textMuted,
  },
});