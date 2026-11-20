import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { THEME } from '../../constants/theme';
import {
  TechBadge,
  TechButton,
  TechCard,
  TechInput,
} from '../../components/ui/TechPrimitives';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleLoginStub = () => {
    // TODO (Акылбек): POST /api/auth/login { email, password } -> save JWT token
    Alert.alert(
      'AUTH // STUB',
      `Вход подготовлен для: ${email || 'user@keepmemory.app'}`
    );
    router.replace('/(tabs)');
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
        <Text style={styles.topCode}>AUTH // 01</Text>
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
            <TechBadge label="SYS // KEEPMEMORY_OS v0.1" active />
            <Text style={styles.title}>ВХОД В СИСТЕМУ</Text>
            <Text style={styles.subtitle}>
              Личный архив атмосферы дня. Авторизуйся, чтобы синхронизировать папки.
            </Text>
          </View>

          <TechCard headerTag="AUTH_MODULE // LOGIN">
            <TechInput
              code="01"
              label="Email"
              placeholder="name@domain.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <TechInput
              code="02"
              label="Пароль"
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TechButton
              title="Войти в архив →"
              onPress={handleLoginStub}
              style={styles.submitBtn}
            />
          </TechCard>

          <View style={styles.footer}>
            <TechButton
              title="Нет аккаунта? Регистрация"
              variant="secondary"
              onPress={() => router.replace('/auth/register')}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  footer: { gap: 10 },
});