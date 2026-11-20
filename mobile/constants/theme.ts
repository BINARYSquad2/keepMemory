import { Platform } from 'react-native';

export const THEME = {
  colors: {
    bg: '#060608',
    surface: '#0D0D11',
    surfaceElevated: '#14141A',
    border: '#22222B',
    borderFocus: '#D4FF35',
    text: '#F4F4F6',
    textMuted: '#8E8E9B',
    textDim: '#52525E',
    accent: '#D4FF35',       // Контрастный ArtTech-акцент
    accentText: '#060608',
    danger: '#FF4545',
  },
  fonts: {
    mono: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
  radius: {
    none: 0,
    xs: 2,
    sm: 4,
  },
  spacing: {
    xs: 6,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
} as const;