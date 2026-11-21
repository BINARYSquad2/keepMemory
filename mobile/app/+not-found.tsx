import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { THEME } from '../constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Страница не найдена' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Страница не найдена</Text>
        <Text style={styles.subtitle}>
          Похоже, эта ссылка устарела или такого экрана не существует.
        </Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Вернуться в дневник</Text>
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
    padding: 24,
    backgroundColor: THEME.colors.bg,
    gap: 10,
  },
  title: {
    fontFamily: THEME.fonts.serif,
    fontSize: 24,
    color: THEME.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
  link: {
    marginTop: 8,
    backgroundColor: THEME.colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: THEME.radius.pill,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.accentText,
  },
});