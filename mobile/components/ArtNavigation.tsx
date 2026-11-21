import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../constants/theme';
import { clearAuthToken, getErrorMessage, hasAuthToken } from '../services/api';

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.8, 320);

interface ArtTopBarProps {
  onOpenMenu: () => void;
}

export function ArtTopBar({ onOpenMenu }: ArtTopBarProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  const isCreate = pathname.includes('/create');
  const isProfile = pathname.includes('/profile');

  const title = isCreate
    ? 'Новый день'
    : isProfile
      ? 'Профиль'
      : 'KeepMemory';

  return (
    <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
      {/* Кнопка бокового меню (две минималистичные линии) */}
      <TouchableOpacity
        onPress={onOpenMenu}
        activeOpacity={0.7}
        style={styles.menuTrigger}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={styles.menuLineLong} />
        <View style={styles.menuLineShort} />
      </TouchableOpacity>

      {/* Чистый редакторский заголовок */}
      <View style={styles.titleWrap}>
        <Text style={styles.brandTitle}>{title}</Text>
        {!isCreate && !isProfile && <View style={styles.brandDot} />}
      </View>

      {/* Правое действие: быстрый "+" или закрыть создание */}
      {isCreate ? (
        <TouchableOpacity
          onPress={() => router.navigate('/(tabs)')}
          activeOpacity={0.75}
          style={styles.iconCircle}
        >
          <Ionicons name="close" size={18} color={THEME.colors.text} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => router.navigate('/(tabs)/create')}
          activeOpacity={0.85}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={18} color={THEME.colors.accentText} />
        </TouchableOpacity>
      )}
    </View>
  );
}

interface ArtSideMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function ArtSideMenu({ visible, onClose }: ArtSideMenuProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(visible);
  const [authStatus, setAuthStatus] = useState<'loading' | 'signedIn' | 'signedOut'>('loading');
  const [authError, setAuthError] = useState<string | null>(null);
  const slideX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setAuthStatus('loading');
      setAuthError(null);
      let active = true;
      hasAuthToken()
        .then((authenticated) => {
          if (active) setAuthStatus(authenticated ? 'signedIn' : 'signedOut');
        })
        .catch((error: unknown) => {
          if (active) {
            setAuthStatus('signedOut');
            setAuthError(getErrorMessage(error));
          }
        });
      Animated.parallel([
        Animated.timing(slideX, {
          toValue: 0,
          duration: 240,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: 220,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
      return () => {
        active = false;
      };
    } else {
      Animated.parallel([
        Animated.timing(slideX, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(fade, {
          toValue: 0,
          duration: 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  const goTo = (href: '/(tabs)' | '/(tabs)/create' | '/(tabs)/profile' | '/auth/login' | '/auth/register') => {
    onClose();
    setTimeout(() => {
      if (href.startsWith('/auth')) {
        router.push(href);
      } else {
        router.navigate(href);
      }
    }, 120);
  };

  const handleLogout = async () => {
    try {
      await clearAuthToken();
      setAuthStatus('signedOut');
      setAuthError(null);
      onClose();
    } catch (error) {
      setAuthError(getErrorMessage(error));
    }
  };

  const navItems = [
    {
      num: '01',
      label: 'Галерея дней',
      sub: 'Архив всех воспоминаний',
      href: '/(tabs)' as const,
      active: pathname === '/' || pathname === '/index',
    },
    {
      num: '02',
      label: 'Сохранить день',
      sub: 'Текст, кадр и музыка',
      href: '/(tabs)/create' as const,
      active: pathname.includes('/create'),
    },
    {
      num: '03',
      label: 'Профиль',
      sub: 'Личные данные и стиль',
      href: '/(tabs)/profile' as const,
      active: pathname.includes('/profile'),
    },
  ];

  if (!mounted) return null;

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        {/* Затемнённый фон — нажатие закрывает меню */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: fade }]} />
        </TouchableWithoutFeedback>

        {/* Выдвижная боковая панель */}
        <Animated.View
          style={[
            styles.drawer,
            {
              width: DRAWER_WIDTH,
              paddingTop: Math.max(insets.top, 20) + 12,
              paddingBottom: Math.max(insets.bottom, 20) + 10,
              transform: [{ translateX: slideX }],
            },
          ]}
        >
          {/* Шапка меню */}
          <View style={styles.drawerHeader}>
            <View>
              <Text style={styles.drawerBrand}>KeepMemory</Text>
              <Text style={styles.drawerTagline}>дневник атмосферы дня</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.hairline} />

          {/* Разделы в стиле каталога выставки */}
          <View style={styles.navList}>
            {navItems.map((item) => (
              <TouchableOpacity
                key={item.num}
                activeOpacity={0.75}
                onPress={() => goTo(item.href)}
                style={[styles.navRow, item.active && styles.navRowActive]}
              >
                <View
                  style={[
                    styles.activeBar,
                    { backgroundColor: item.active ? THEME.colors.accent : 'transparent' },
                  ]}
                />
                <Text
                  style={[
                    styles.navNum,
                    item.active && { color: THEME.colors.accent },
                  ]}
                >
                  {item.num}
                </Text>
                <View style={styles.navTextCol}>
                  <Text
                    style={[
                      styles.navLabel,
                      item.active && { color: THEME.colors.text },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text style={styles.navSub}>{item.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Нижняя часть меню: аккаунт */}
          <View style={styles.drawerFooter}>
            <View style={styles.hairline} />
            {authError ? <Text style={styles.authError}>{authError}</Text> : null}
            {authStatus === 'signedOut' ? (
              <View style={styles.authLinks}>
                <TouchableOpacity onPress={() => goTo('/auth/login')} style={styles.authBtn}>
                  <Text style={styles.authBtnText}>Войти</Text>
                </TouchableOpacity>
                <Text style={styles.authDivider}>·</Text>
                <TouchableOpacity onPress={() => goTo('/auth/register')} style={styles.authBtn}>
                  <Text style={styles.authBtnText}>Регистрация</Text>
                </TouchableOpacity>
              </View>
            ) : authStatus === 'signedIn' ? (
              <TouchableOpacity onPress={handleLogout} style={styles.authBtn}>
                <Text style={styles.authBtnText}>Выйти из аккаунта</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.bg,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  menuTrigger: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    gap: 6,
  },
  menuLineLong: {
    width: 22,
    height: 1.8,
    backgroundColor: THEME.colors.text,
    borderRadius: 2,
  },
  menuLineShort: {
    width: 14,
    height: 1.8,
    backgroundColor: THEME.colors.accent,
    borderRadius: 2,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 21,
    color: THEME.colors.text,
    letterSpacing: 0.3,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: THEME.colors.accent,
    marginTop: 2,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 99,
    backgroundColor: THEME.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(3, 3, 6, 0.72)',
  },
  drawer: {
    flex: 1,
    backgroundColor: '#0B0B10',
    borderRightWidth: 1,
    borderRightColor: THEME.colors.borderStrong,
    paddingHorizontal: 22,
    justifyContent: 'space-between',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 18,
  },
  drawerBrand: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    color: THEME.colors.text,
  },
  drawerTagline: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 0.4,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hairline: {
    height: 1,
    backgroundColor: THEME.colors.border,
  },
  navList: {
    flex: 1,
    paddingTop: 26,
    gap: 10,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: THEME.radius.sm,
    gap: 12,
  },
  navRowActive: {
    backgroundColor: THEME.colors.surfaceElevated,
  },
  activeBar: {
    width: 2.5,
    height: 28,
    borderRadius: 99,
  },
  navNum: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.textDim,
  },
  navTextCol: {
    flex: 1,
    gap: 2,
  },
  navLabel: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    color: THEME.colors.textMuted,
  },
  navSub: {
    fontSize: 12,
    color: THEME.colors.textDim,
  },
  drawerFooter: {
    gap: 16,
  },
  authLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authBtn: {
    paddingVertical: 6,
  },
  authBtnText: {
    color: THEME.colors.textMuted,
    fontSize: 13,
  },
  authError: {
    color: THEME.colors.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  authDivider: {
    color: THEME.colors.textDim,
  },
});