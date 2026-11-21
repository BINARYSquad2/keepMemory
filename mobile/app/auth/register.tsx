import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { THEME } from '../../constants/theme';
import { ApiError, getErrorMessage, register } from '../../services/api';
import {
  TechBadge,
  TechButton,
  TechCard,
  TechInput,
} from '../../components/ui/TechPrimitives';

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color={THEME.colors.text} />
          <Text style={styles.backText}>НАЗАД</Text>
        </TouchableOpacity>
        <Text style={styles.topCode}>AUTH // 02</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TechBadge label="NEW_IDENTITY // INIT" active />
            <Text style={styles.title}>РЕГИСТРАЦИЯ</Text>
            <Text style={styles.subtitle}>
              Создай профиль, чтобы хранить визуальный дневник и настройки стиля.
            </Text>
          </View>

          <TechCard headerTag="AUTH_MODULE // CREATE_USER">
            <TechInput
              code="01"
              label="Имя / Никнейм"
              placeholder="Как к тебе обращаться"
              value={name}
              onChangeText={setName}
            />

            <TechInput
              code="02"
              label="Email"
              placeholder="name@domain.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <TechInput
              code="03"
              label="Пароль"
              placeholder="Минимум 8 символов"
              secureTextEntry
              showPasswordToggle
              value={password}
              onChangeText={setPassword}
            />

            <TechInput
              code="04"
              label="Повтор пароля"
              placeholder="Повтори пароль"
              secureTextEntry
              showPasswordToggle
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <TechButton
              title={loading ? 'СОЗДАНИЕ...' : 'Создать профиль →'}
              onPress={handleRegister}
              disabled={loading}
              style={styles.submitBtn}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </TechCard>

          <View style={styles.footer}>
            <TechButton
              title="Уже есть аккаунт? Войти"
              variant="secondary"
              onPress={() => router.replace('/auth/login')}
            />
          </View>
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
              Этот email уже зарегистрирован. Войдите в аккаунт.
            </Text>
            <TechButton
              title="Войти"
              onPress={() => {
                setDuplicateEmail(false);
                router.replace('/auth/login');
              }}
            />
            <TechButton
              title="Закрыть"
              variant="secondary"
              onPress={() => setDuplicateEmail(false)}
            />
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
    paddingHorizontal: THEME.spacing.lg,
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
    fontFamily: THEME.fonts.mono,
    fontSize: 12,
    letterSpacing: 1.2,
    color: THEME.colors.text,
  },
  topCode: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.textDim,
    letterSpacing: 1,
  },
  container: {
    flexGrow: 1,
    padding: THEME.spacing.lg,
    justifyContent: 'center',
    gap: 24,
  },
  header: { gap: 10 },
  title: {
    color: THEME.colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subtitle: {
    color: THEME.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  submitBtn: { marginTop: 8 },
  errorText: {
    color: THEME.colors.danger,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  footer: { gap: 10 },
  alertOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: THEME.spacing.lg,
    backgroundColor: 'rgba(3, 3, 6, 0.72)',
  },
  alertCard: {
    gap: 14,
    padding: THEME.spacing.lg,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.radius.xs,
  },
  alertTitle: {
    color: THEME.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  alertMessage: {
    color: THEME.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});