import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../../constants/theme';
import { TechBadge } from '../../components/ui/TechPrimitives';

export default function ArchiveStubScreen() {
  return (
    <View style={styles.container}>
      <TechBadge label="ARCHIVE // READY FOR MVP" active />
      <Text style={styles.title}>Лента папок дня</Text>
      <Text style={styles.subtitle}>
        На следующем шаге подключим сюда список папок из memoryStore и переход к визуализации на Skia.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
    padding: THEME.spacing.lg,
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    color: THEME.colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: THEME.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});