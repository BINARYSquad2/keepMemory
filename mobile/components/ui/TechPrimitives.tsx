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
  style,
  showPasswordToggle = false,
  secureTextEntry,
  ...inputProps
}: TechInputProps) {
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
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
      activeOpacity={disabled ? 1 : 0.82}
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.colors.surface,
  },
  badgeActive: {
    borderColor: THEME.colors.accent,
    backgroundColor: THEME.colors.accentSoft,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  badgeTextActive: {
    color: THEME.colors.accent,
  },
  inputGroup: {
    marginBottom: THEME.spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.sm,
    color: THEME.colors.text,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
  },
  inputFocused: {
    borderColor: THEME.colors.borderFocus,
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
    borderRadius: THEME.radius.pill,
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
    borderColor: THEME.colors.borderStrong,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    paddingVertical: 10,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
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
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  cardHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  cardBody: {
    padding: 16,
  },
});