import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { THEME } from '../../constants/theme';
import { ApiError, getErrorMessage, register } from '../../services/api';

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateEmail, setDuplicateEmail] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleRegister = async () => {
    if (loading) return;
    setError(null);

    if (!name.trim() || !email.trim() || !password) {
      setError('Заполните имя, email и пароль.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают.');
      return;
    }

    setLoading(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password });
      router.replace('/(tabs)');
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 409) {
        setDuplicateEmail(true);
      } else {
        setError(getErrorMessage(requestError));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={18} color={THEME.colors.text} />
          <Text style={styles.backText}>Назад</Text>
        </TouchableOpacity>
        <Text style={styles.brandMini}>KeepMemory</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>НОВЫЙ ПРОФИЛЬ</Text>
            <Text style={styles.title}>Создать дневник</Text>
            <Text style={styles.subtitle}>
              Твои воспоминания будут храниться в личном архиве и останутся доступны с любого телефона.
            </Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>01 · Имя</Text>
              <TextInput
                style={styles.input}
                placeholder="Как к тебе обращаться"
                placeholderTextColor={THEME.colors.textDim}
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setError(null);
                }}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>02 · Email</Text>
              <TextInput
                style={styles.input}
                placeholder="name@domain.com"
                placeholderTextColor={THEME.colors.textDim}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setError(null);
                }}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>03 · Пароль</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Минимум 8 символов"
                  placeholderTextColor={THEME.colors.textDim}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    setError(null);
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={THEME.colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>04 · Повтор пароля</Text>
              <TextInput
                style={styles.input}
                placeholder="Повтори пароль"
                placeholderTextColor={THEME.colors.textDim}
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  setError(null);
                }}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDim]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={THEME.colors.accentText} />
              ) : (
                <Text style={styles.primaryBtnText}>СОЗДАТЬ ПРОФИЛЬ →</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => router.replace('/auth/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.switchText}>
              Уже есть аккаунт? <Text style={styles.switchHighlight}>Войти</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        transparent
        visible={duplicateEmail}
        animationType="fade"
        onRequestClose={() => setDuplicateEmail(false)}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>Аккаунт уже существует</Text>
            <Text style={styles.alertMessage}>
              Этот email уже зарегистрирован. Войдите в существующий дневник.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                setDuplicateEmail(false);
                router.replace('/auth/login');
              }}
            >
              <Text style={styles.primaryBtnText}>ВОЙТИ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setDuplicateEmail(false)}
            >
              <Text style={styles.secondaryBtnText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.colors.bg },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingRight: 12,
  },
  backText: {
    fontFamily: THEME.fonts.serif,
    fontSize: 16,
    color: THEME.colors.text,
  },
  brandMini: {
    fontFamily: THEME.fonts.serif,
    fontSize: 16,
    color: THEME.colors.textMuted,
  },
  container: {
    flexGrow: 1,
    padding: THEME.spacing.lg,
    justifyContent: 'center',
    gap: 20,
  },
  header: { gap: 8 },
  eyebrow: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: THEME.colors.accent,
  },
  title: {
    fontFamily: THEME.fonts.serif,
    color: THEME.colors.text,
    fontSize: 30,
  },
  subtitle: {
    color: THEME.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: 16,
    gap: 13,
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
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.sm,
    paddingLeft: 14,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    color: THEME.colors.text,
    fontSize: 14,
  },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  errorText: {
    color: THEME.colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  primaryBtn: {
    backgroundColor: THEME.colors.accent,
    paddingVertical: 15,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    marginTop: 4,
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
  btnDim: { opacity: 0.55 },
  primaryBtnText: {
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.accentText,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  switchBtn: { alignItems: 'center', paddingVertical: 8 },
  switchText: { color: THEME.colors.textMuted, fontSize: 13 },
  switchHighlight: { color: THEME.colors.accent, fontWeight: '600' },
  alertOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: THEME.spacing.lg,
    backgroundColor: 'rgba(3, 3, 6, 0.72)',
  },
  alertCard: {
    gap: 12,
    padding: THEME.spacing.lg,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.radius.md,
  },
  alertTitle: {
    fontFamily: THEME.fonts.serif,
    color: THEME.colors.text,
    fontSize: 21,
  },
  alertMessage: {
    color: THEME.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
});