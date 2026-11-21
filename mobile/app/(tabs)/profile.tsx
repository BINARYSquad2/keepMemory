import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';
import {
  clearAuthToken,
  getErrorMessage,
  getProfile,
  hasAuthToken,
  updateProfile,
  UserProfile,
} from '../../services/api';

function formatJoinedDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ProfileScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyUser = (user: UserProfile) => {
    setDisplayName(user.displayName);
    setHandle(user.handle);
    setBio(user.bio);
    setEmail(user.email);
    setCreatedAt(user.createdAt);
  };

  const resetUser = () => {
    setDisplayName('');
    setHandle('');
    setBio('');
    setEmail('');
    setCreatedAt('');
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadProfile = async () => {
        setLoading(true);
        setError(null);
        setSavedNotice(false);
        try {
          if (!(await hasAuthToken())) {
            if (active) {
              setSignedIn(false);
              resetUser();
            }
            return;
          }

          const user = await getProfile();
          if (active) {
            setSignedIn(true);
            applyUser(user);
          }
        } catch (requestError) {
          if (active) {
            setSignedIn(false);
            resetUser();
            setError(getErrorMessage(requestError));
          }
        } finally {
          if (active) setLoading(false);
        }
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
    setSavedNotice(false);
    try {
      const user = await updateProfile({
        displayName: displayName.trim(),
        handle: handle.trim(),
        bio: bio.trim(),
      });
      applyUser(user);
      setSavedNotice(true);
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
      setSavedNotice(false);
      resetUser();
      setError(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  const initials = (displayName.trim().slice(0, 2) || 'KM').toUpperCase();
  const joinedLabel = formatJoinedDate(createdAt);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Шапка автора дневника */}
      <View style={styles.identityCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetters}>{initials}</Text>
        </View>
        <View style={styles.identityMeta}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: signedIn ? THEME.colors.accent : THEME.colors.textDim },
              ]}
            />
            <Text style={styles.statusText}>
              {loading
                ? 'Загрузка профиля…'
                : signedIn
                  ? 'Дневник синхронизирован'
                  : 'Гостевой режим'}
            </Text>
          </View>

          <Text style={styles.name}>
            {displayName || (signedIn ? 'Автор дневника' : 'Войди в аккаунт')}
          </Text>

          {handle ? <Text style={styles.handle}>{handle}</Text> : null}
          {email ? <Text style={styles.emailText}>{email}</Text> : null}
          {joinedLabel ? (
            <Text style={styles.joinedText}>В KeepMemory с {joinedLabel}</Text>
          ) : null}
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator color={THEME.colors.accent} />
        </View>
      ) : signedIn ? (
        <>
          <View style={styles.formCard}>
            <Text style={styles.cardEyebrow}>ЛИЧНЫЕ ДАННЫЕ</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>01 · Отображаемое имя</Text>
              <TextInput
                style={styles.input}
                placeholder="Как тебя называть в дневнике"
                placeholderTextColor={THEME.colors.textDim}
                value={displayName}
                onChangeText={(v) => {
                  setDisplayName(v);
                  setSavedNotice(false);
                }}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>02 · Никнейм</Text>
              <TextInput
                style={styles.input}
                placeholder="@username"
                placeholderTextColor={THEME.colors.textDim}
                autoCapitalize="none"
                value={handle}
                onChangeText={(v) => {
                  setHandle(v);
                  setSavedNotice(false);
                }}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>03 · Подпись дневника</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                placeholder="Пара слов о себе или о том, ради чего ведёшь этот архив…"
                placeholderTextColor={THEME.colors.textDim}
                multiline
                textAlignVertical="top"
                value={bio}
                onChangeText={(v) => {
                  setBio(v);
                  setSavedNotice(false);
                }}
              />
            </View>

            {savedNotice ? (
              <View style={styles.savedRow}>
                <Ionicons name="checkmark-circle" size={16} color={THEME.colors.accent} />
                <Text style={styles.savedText}>Изменения сохранены</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryBtn, saving && styles.btnDim]}
              onPress={handleSaveProfile}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={THEME.colors.accentText} />
              ) : (
                <Text style={styles.primaryBtnText}>СОХРАНИТЬ ИЗМЕНЕНИЯ</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={16} color={THEME.colors.textMuted} />
            <Text style={styles.logoutText}>Выйти из аккаунта</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.cardEyebrow}>СИНХРОНИЗАЦИЯ ДНЕВНИКА</Text>
          <Text style={styles.guestTitle}>Твои дни всегда с тобой</Text>
          <Text style={styles.guestSub}>
            Войди или создай аккаунт, чтобы сохранять папки дней в архиве и открывать их с любого устройства.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>ВОЙТИ В АККАУНТ →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/auth/register')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryBtnText}>Создать новый аккаунт</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: THEME.spacing.md, gap: 16, paddingBottom: 44 },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: 18,
  },
  avatarCircle: {
    width: 66,
    height: 66,
    borderRadius: 99,
    backgroundColor: THEME.colors.accentSoft,
    borderWidth: 1,
    borderColor: THEME.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetters: {
    fontFamily: THEME.fonts.serif,
    color: THEME.colors.accent,
    fontSize: 23,
    fontWeight: '700',
  },
  identityMeta: { flex: 1, gap: 3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 99 },
  statusText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    color: THEME.colors.textMuted,
    letterSpacing: 0.6,
  },
  name: {
    fontFamily: THEME.fonts.serif,
    color: THEME.colors.text,
    fontSize: 22,
    marginTop: 2,
  },
  handle: {
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.accent,
    fontSize: 12,
  },
  emailText: {
    color: THEME.colors.textMuted,
    fontSize: 12,
  },
  joinedText: {
    color: THEME.colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  centerLoader: { paddingVertical: 32, alignItems: 'center' },
  errorBox: {
    backgroundColor: 'rgba(255, 84, 84, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 84, 84, 0.35)',
    borderRadius: THEME.radius.sm,
    padding: 12,
  },
  errorText: {
    color: THEME.colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  formCard: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: 16,
    gap: 14,
  },
  cardEyebrow: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.3,
    color: THEME.colors.textDim,
  },
  field: { gap: 6 },
  fieldLabel: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.accent,
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: THEME.colors.text,
    fontSize: 14,
  },
  bioInput: {
    minHeight: 88,
    lineHeight: 20,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.accent,
  },
  primaryBtn: {
    backgroundColor: THEME.colors.accent,
    paddingVertical: 15,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    marginTop: 2,
  },
  btnDim: { opacity: 0.55 },
  primaryBtnText: {
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.accentText,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    paddingVertical: 14,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  logoutText: {
    color: THEME.colors.textMuted,
    fontSize: 13,
  },
  guestTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 22,
    color: THEME.colors.text,
  },
  guestSub: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});