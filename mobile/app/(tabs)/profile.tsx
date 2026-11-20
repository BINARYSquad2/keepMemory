import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { THEME } from '../../constants/theme';
import {
  TechBadge,
  TechButton,
  TechCard,
  TechInput,
} from '../../components/ui/TechPrimitives';

export default function ProfileScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('Archivist');
  const [handle, setHandle] = useState('@keepmemory_user');
  const [bio, setBio] = useState('Фиксирую свет, звук и ощущение дней.');

  const handleSaveProfile = () => {
    // TODO (Акылбек): PATCH /api/profile { displayName, handle, bio }
    Alert.alert('PROFILE // STUB', 'Изменения профиля готовы к отправке на сервер.');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Шапка профиля в стиле ArtTech */}
      <View style={styles.identityRow}>
        <View style={styles.avatarBox}>
          <Text style={styles.avatarLetters}>
            {(displayName.slice(0, 2) || 'KM').toUpperCase()}
          </Text>
        </View>
        <View style={styles.identityMeta}>
          <TechBadge label="STATUS // LOCAL_MODE" active />
          <Text style={styles.name}>{displayName || 'Без имени'}</Text>
          <Text style={styles.handle}>{handle}</Text>
        </View>
      </View>

      {/* Форма редактирования */}
      <TechCard headerTag="EDIT_PROFILE // PARAMETERS">
        <TechInput
          code="01"
          label="Отображаемое имя"
          placeholder="Твоё имя"
          value={displayName}
          onChangeText={setDisplayName}
        />

        <TechInput
          code="02"
          label="Никнейм"
          placeholder="@username"
          autoCapitalize="none"
          value={handle}
          onChangeText={setHandle}
        />

        <TechInput
          code="03"
          label="Подпись дневника"
          placeholder="Короткое описание..."
          multiline
          value={bio}
          onChangeText={setBio}
        />

        <TechButton title="Сохранить изменения" onPress={handleSaveProfile} />
      </TechCard>

      {/* Быстрый доступ к экранам авторизации для проверки и стыковки */}
      <TechCard headerTag="AUTH_SCREENS // PREVIEW">
        <Text style={styles.hint}>
          Временные кнопки для проверки UI авторизации до подключения токенов бэкенда.
        </Text>
        <View style={styles.authButtons}>
          <TechButton
            title="Экран входа"
            variant="secondary"
            onPress={() => router.push('/auth/login')}
          />
          <TechButton
            title="Регистрация"
            variant="secondary"
            onPress={() => router.push('/auth/register')}
          />
        </View>
      </TechCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.lg, gap: 20, paddingBottom: 40 },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  avatarBox: {
    width: 68,
    height: 68,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.accent,
    borderRadius: THEME.radius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetters: {
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.accent,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1,
  },
  identityMeta: { flex: 1, gap: 4 },
  name: { color: THEME.colors.text, fontSize: 20, fontWeight: '700' },
  handle: {
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.textMuted,
    fontSize: 12,
  },
  hint: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  authButtons: { gap: 10 },
});