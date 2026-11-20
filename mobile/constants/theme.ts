import { Platform } from 'react-native';

export const THEME = {
  colors: {
    bg: '#07070A',
    surface: '#101015',
    surfaceElevated: '#17171F',
    glass: 'rgba(18, 18, 24, 0.92)',
    border: 'rgba(255, 255, 255, 0.09)',
    borderStrong: 'rgba(255, 255, 255, 0.18)',
    borderFocus: '#D8FF4B',
    text: '#F4EFE6',          // Тёплая выставочная бумага вместо холодного белого
    textMuted: '#9895A3',
    textDim: '#5B5966',
    accent: '#D8FF4B',        // Сдержанный ArtTech-лайм
    accentSoft: 'rgba(216, 255, 75, 0.14)',
    accentText: '#07070A',
    danger: '#FF5454',
  },
  fonts: {
    mono: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    serif: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'serif',
    }),
  },
  radius: {
    none: 0,
    xs: 4,
    sm: 10,
    md: 16,
    lg: 24,
    pill: 999,
  },
  spacing: {
    xs: 6,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
} as const;