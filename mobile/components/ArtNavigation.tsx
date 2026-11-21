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
import { Href, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../constants/theme';
import { clearAuthToken, getErrorMessage, hasAuthToken } from '../services/api';

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.82, 330);

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

  const moduleTag = isCreate
    ? 'CAPTURE.EXE'
    : isProfile
      ? 'PROFILE.EXE'
      : 'ARCHIVE.EXE';

  return (
    <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
      {/* Кнопка бокового меню */}
      <TouchableOpacity
        onPress={onOpenMenu}
        activeOpacity={0.7}
        style={styles.menuTrigger}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={styles.menuLineLong} />
        <View style={styles.menuLineShort} />
      </TouchableOpacity>

      {/* Центр: хай-тек модуль + тёплый выставочный заголовок */}
      <View style={styles.centerCol}>
        <View style={styles.moduleRow}>
          <View style={styles.liveDot} />
          <Text style={styles.moduleTag}>{moduleTag}</Text>
        </View>
        <Text style={styles.brandTitle}>{title}</Text>
      </View>

      {/* Правые действия: гид + создать/закрыть */}
      <View style={styles.rightActions}>
        <TouchableOpacity
          onPress={() => router.push('/guide' as Href)}
          activeOpacity={0.75}
          style={styles.iconCircle}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="help" size={16} color={THEME.colors.warmGold} />
        </TouchableOpacity>

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
            <Ionicons name="add" size={19} color={THEME.colors.accentText} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

interface ArtSideMenuProps {
  visible: boolean;
  onClose: () => void;
}

type DrawerHref =
  | '/(tabs)'
  | '/(tabs)/create'
  | '/(tabs)/profile'
  | '/guide'
  | '/auth/login'
  | '/auth/register';

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
  }, [visible, fade, slideX]);

  const goTo = (href: DrawerHref) => {
    onClose();
    setTimeout(() => {
      if (href.startsWith('/auth') || href === '/guide') {
        router.push(href as Href);
      } else {
        router.navigate(href as Href);
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

  const navItems: Array<{
    num: string;
    code: string;
    label: string;
    sub: string;
    href: DrawerHref;
    active: boolean;
  }> = [
    {
      num: '01',
      code: 'ARCHIVE',
      label: 'Галерея дней',
      sub: 'Папки и лента воспоминаний',
      href: '/(tabs)',
      active: pathname === '/' || pathname === '/index',
    },
    {
      num: '02',
      code: 'CAPTURE',
      label: 'Сохранить день',
      sub: 'Текст, альбом фото и песня',
      href: '/(tabs)/create',
      active: pathname.includes('/create'),
    },
    {
      num: '03',
      code: 'PROFILE',
      label: 'Профиль',
      sub: 'Личные данные и облако',
      href: '/(tabs)/profile',
      active: pathname.includes('/profile'),
    },
    {
      num: '04',
      code: 'GUIDE.EXE',
      label: 'Гид и система',
      sub: 'Как работает ArtTech-дневник',
      href: '/guide',
      active: pathname.includes('/guide'),
    },
  ];

  if (!mounted) return null;

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: fade }]} />
        </TouchableWithoutFeedback>

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
            <View style={styles.drawerBrandCol}>
              <Text style={styles.drawerEyebrow}>[KEEPMEMORY // ARTTECH]</Text>
              <Text style={styles.drawerBrand}>KeepMemory_</Text>
              <Text style={styles.drawerTagline}>Make the Invisible Visible</Text>
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
                activeOpacity={0.78}
                onPress={() => goTo(item.href)}
                style={[styles.navRow, item.active && styles.navRowActive]}
              >
                <View
                  style={[
                    styles.activeBar,
                    { backgroundColor: item.active ? THEME.colors.accent : 'transparent' },
                  ]}
                />
                <View style={styles.navNumCol}>
                  <Text style={[styles.navNum, item.active && { color: THEME.colors.accent }]}>
                    {item.num} //
                  </Text>
                  <Text style={styles.navCode}>{item.code}</Text>
                </View>
                <View style={styles.navTextCol}>
                  <Text style={[styles.navLabel, item.active && { color: THEME.colors.text }]}>
                    {item.label}
                  </Text>
                  <Text style={styles.navSub}>{item.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Нижняя часть меню */}
          <View style={styles.drawerFooter}>
            <View style={styles.hairline} />
            {authError ? <Text style={styles.authError}>{authError}</Text> : null}
            {authStatus === 'signedOut' ? (
              <View style={styles.authLinks}>
                <TouchableOpacity onPress={() => goTo('/auth/login')} style={styles.authBtn}>
                  <Text style={styles.authBtnText}>Войти</Text>
                </TouchableOpacity>
                <Text style={styles.authDivider}>//</Text>
                <TouchableOpacity onPress={() => goTo('/auth/register')} style={styles.authBtn}>
                  <Text style={styles.authBtnText}>Регистрация</Text>
                </TouchableOpacity>
              </View>
            ) : authStatus === 'signedIn' ? (
              <TouchableOpacity onPress={handleLogout} style={styles.authBtn}>
                <Text style={styles.authBtnText}>Выйти из аккаунта</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.footerBuild}>GENESIS.EXE // ART_DIARY_2026</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  menuTrigger: {
    width: 38,
    height: 38,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  menuLineLong: {
    width: 18,
    height: 1.7,
    backgroundColor: THEME.colors.text,
    borderRadius: 2,
  },
  menuLineShort: {
    width: 12,
    height: 1.7,
    backgroundColor: THEME.colors.accent,
    borderRadius: 2,
    alignSelf: 'flex-start',
    marginLeft: 9,
  },
  centerCol: {
    alignItems: 'center',
    gap: 1,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 99,
    backgroundColor: THEME.colors.accent,
  },
  moduleTag: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: THEME.colors.textDim,
  },
  brandTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    color: THEME.colors.text,
    letterSpacing: 0.3,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    backgroundColor: THEME.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalRoot: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(3, 3, 6, 0.78)',
  },
  drawer: {
    flex: 1,
    backgroundColor: '#09090F',
    borderRightWidth: 1,
    borderRightColor: THEME.colors.borderStrong,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 16,
  },
  drawerBrandCol: { gap: 4 },
  drawerEyebrow: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: THEME.colors.accent,
  },
  drawerBrand: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    color: THEME.colors.text,
  },
  drawerTagline: {
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.warmGold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: THEME.radius.sm,
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
    paddingTop: 22,
    gap: 10,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 10,
  },
  navRowActive: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderColor: THEME.colors.borderStrong,
  },
  activeBar: {
    width: 2.5,
    height: 30,
    borderRadius: 99,
  },
  navNumCol: {
    width: 58,
    gap: 2,
  },
  navNum: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textDim,
  },
  navCode: {
    fontFamily: THEME.fonts.mono,
    fontSize: 8,
    letterSpacing: 0.8,
    color: THEME.colors.textDim,
  },
  navTextCol: {
    flex: 1,
    gap: 2,
  },
  navLabel: {
    fontFamily: THEME.fonts.serif,
    fontSize: 18,
    color: THEME.colors.textMuted,
  },
  navSub: {
    fontSize: 11,
    color: THEME.colors.textDim,
  },
  drawerFooter: {
    gap: 12,
  },
  authLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authBtn: { paddingVertical: 4 },
  authBtnText: {
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.text,
    fontSize: 12,
  },
  authError: {
    color: THEME.colors.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  authDivider: {
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.textDim,
    fontSize: 11,
  },
  footerBuild: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: THEME.colors.textDim,
  },
});