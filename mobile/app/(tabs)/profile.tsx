import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { THEME } from '../../constants/theme';
import {
  clearAuthToken,
  getErrorMessage,
  getProfile,
  hasAuthToken,
  updateProfile,
  UserProfile,
} from '../../services/api';
import {
  TechBadge,
  TechButton,
  TechCard,
  TechInput,
} from '../../components/ui/TechPrimitives';

export default function ProfileScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadProfile = async () => {
        setLoading(true);
        setError(null);
        try {
          if (!(await hasAuthToken())) {
            if (active) {
              setSignedIn(false);
              setDisplayName('');
              setHandle('');
              setBio('');
            }
            return;
          }

          const user = await getProfile();
          if (active) {
            setSignedIn(true);
            setProfileFields(user);
          }
        } catch (requestError) {
          if (active) {
            setSignedIn(false);
            setDisplayName('');
            setHandle('');
            setBio('');
            setError(getErrorMessage(requestError));
          }
        } finally {
          if (active) setLoading(false);
        }
      };

      const setProfileFields = (user: UserProfile) => {
        setDisplayName(user.displayName);
        setHandle(user.handle);
        setBio(user.bio);
      };

      void loadProfile();
      return () => {
        active = false;
      };
    }, [])
  );

  const handleSaveProfile = async () => {
    if (!signedIn || saving) return;
    setSaving(true);
    setError(null);
    try {
      const user = await updateProfile({ displayName, handle, bio });
      setDisplayName(user.displayName);
      setHandle(user.handle);
      setBio(user.bio);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await clearAuthToken();
      setSignedIn(false);
      setDisplayName('');
      setHandle('');
      setBio('');
      setError(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
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
          <TechBadge
            label={loading ? 'API // CONNECTING' : signedIn ? 'API // CONNECTED' : 'AUTH // REQUIRED'}
            active={signedIn}
          />
          <Text style={styles.name}>{displayName || (signedIn ? 'Без имени' : 'Войдите в аккаунт')}</Text>
          <Text style={styles.handle}>{handle}</Text>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!loading && signedIn ? (
        <>
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

            <TechButton
              title={saving ? 'СОХРАНЕНИЕ...' : 'Сохранить изменения'}
              onPress={handleSaveProfile}
              disabled={saving}
            />
          </TechCard>
          <TechButton title="Выйти из аккаунта" variant="secondary" onPress={handleLogout} />
        </>
      ) : !loading ? (
        <TechCard headerTag="AUTH // REQUIRED">
          <Text style={styles.hint}>Войдите или зарегистрируйтесь, чтобы загрузить профиль и дневник.</Text>
          <View style={styles.authButtons}>
          <TechButton
            title="Войти"
            onPress={() => router.push('/auth/login')}
          />
          <TechButton
            title="Регистрация"
            variant="secondary"
            onPress={() => router.push('/auth/register')}
          />
          </View>
        </TechCard>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.lg, gap: 20, paddingBottom: 115 },
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
  errorText: {
    color: THEME.colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  authButtons: { gap: 10 },
});