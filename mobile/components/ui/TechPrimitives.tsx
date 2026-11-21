import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';

interface TechBadgeProps {
  label: string;
  active?: boolean;
}

export function TechBadge({ label, active = false }: TechBadgeProps) {
  return (
    <View style={[styles.badge, active && styles.badgeActive]}>
      <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
        {label}
      </Text>
    </View>
  );
}

interface TechInputProps extends TextInputProps {
  label: string;
  code?: string;
  showPasswordToggle?: boolean;
}

export function TechInput({
  label,
  code,
  style,
  showPasswordToggle = false,
  secureTextEntry,
  ...inputProps
}: TechInputProps) {
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <View style={styles.inputGroup}>
      <View style={styles.labelRow}>
        {code ? <Text style={styles.labelCode}>[{code}]</Text> : null}
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={showPasswordToggle && styles.passwordInputWrap}>
        <TextInput
          placeholderTextColor={THEME.colors.textDim}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          secureTextEntry={
            showPasswordToggle ? !passwordVisible : secureTextEntry
          }
          style={[
            styles.input,
            focused && styles.inputFocused,
            inputProps.multiline && styles.inputMultiline,
            showPasswordToggle && styles.passwordInput,
            style,
          ]}
          {...inputProps}
        />
        {showPasswordToggle ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Скрыть пароль' : 'Показать пароль'}
            onPress={() => setPasswordVisible((visible) => !visible)}
            style={styles.passwordToggle}
            hitSlop={8}
          >
            <Ionicons
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={THEME.colors.textMuted}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

interface TechButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: ViewStyle;
}

export function TechButton({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
  style,
}: TechButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.75}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        variant === 'primary' && styles.btnPrimary,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'ghost' && styles.btnGhost,
        disabled && styles.buttonDisabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          variant === 'primary' && styles.btnTextPrimary,
          variant === 'secondary' && styles.btnTextSecondary,
          variant === 'ghost' && styles.btnTextGhost,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

interface TechCardProps {
  children: React.ReactNode;
  headerTag?: string;
  style?: ViewStyle;
}

export function TechCard({ children, headerTag, style }: TechCardProps) {
  return (
    <View style={[styles.card, style]}>
      {headerTag ? (
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeaderText}>{headerTag}</Text>
          <View style={styles.cardDot} />
        </View>
      ) : null}
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.xs,
    backgroundColor: THEME.colors.surface,
  },
  badgeActive: {
    borderColor: THEME.colors.accent,
  },
  badgeText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
  },
  badgeTextActive: {
    color: THEME.colors.accent,
  },
  inputGroup: {
    marginBottom: THEME.spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  labelCode: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.accent,
  },
  label: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: THEME.colors.textMuted,
  },
  input: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.xs,
    color: THEME.colors.text,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  inputFocused: {
    borderColor: THEME.colors.borderFocus,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  passwordInputWrap: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  passwordToggle: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: THEME.radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonDisabled: { opacity: 0.55 },
  btnPrimary: {
    backgroundColor: THEME.colors.accent,
    borderColor: THEME.colors.accent,
  },
  btnSecondary: {
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.border,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    paddingVertical: 10,
  },
  btnText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  btnTextPrimary: {
    color: THEME.colors.accentText,
  },
  btnTextSecondary: {
    color: THEME.colors.text,
  },
  btnTextGhost: {
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  cardHeaderText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
  },
  cardDot: {
    width: 6,
    height: 6,
    borderRadius: 1,
    backgroundColor: THEME.colors.accent,
  },
  cardBody: {
    padding: 16,
  },
});