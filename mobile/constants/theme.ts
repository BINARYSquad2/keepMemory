import { Platform } from 'react-native';

export const THEME = {
  colors: {
    bg: '#060609',
    surface: '#0E0E14',
    surfaceElevated: '#15151E',
    surfacePanel: '#0A0A10',
    glass: 'rgba(14, 14, 20, 0.94)',
    border: 'rgba(255, 255, 255, 0.09)',
    borderStrong: 'rgba(255, 255, 255, 0.2)',
    borderFocus: '#D8FF4B',
    gridLine: 'rgba(255, 255, 255, 0.045)',
    text: '#F4EFE6',
    textMuted: '#9B98A8',
    textDim: '#605D6E',
    accent: '#D8FF4B',
    accentSoft: 'rgba(216, 255, 75, 0.13)',
    accentGlow: 'rgba(216, 255, 75, 0.34)',
    accentText: '#060609',
    warmGold: '#E8C58E',
    warmGoldSoft: 'rgba(232, 197, 142, 0.13)',
    cyanSignal: '#7FE3FF',
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