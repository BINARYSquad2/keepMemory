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

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.82, 320);

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
      <TouchableOpacity
        onPress={onOpenMenu}
        activeOpacity={0.7}
        style={styles.menuTrigger}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Открыть меню"
      >
        <View style={styles.menuLineLong} />
        <View style={styles.menuLineShort} />
      </TouchableOpacity>

      <Text style={styles.brandTitle}>{title}</Text>

      {isCreate ? (
        <TouchableOpacity
          onPress={() => router.navigate('/(tabs)')}
          activeOpacity={0.75}
          style={styles.iconBtn}
          accessibilityLabel="Закрыть создание записи"
        >
          <Ionicons name="close" size={18} color={THEME.colors.text} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => router.navigate('/(tabs)/create')}
          activeOpacity={0.85}
          style={styles.addBtn}
          accessibilityLabel="Создать запись"
        >
          <Ionicons name="add" size={20} color={THEME.colors.accentText} />
        </TouchableOpacity>
      )}
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

type MenuIconName =
  | 'book-outline'
  | 'add-circle-outline'
  | 'person-outline'
  | 'compass-outline';

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
    key: string;
    icon: MenuIconName;
    label: string;
    sub: string;
    href: DrawerHref;
    active: boolean;
  }> = [
    {
      key: 'archive',
      icon: 'book-outline',
      label: 'Дневник',
      sub: 'Записи, альбомы и поиск',
      href: '/(tabs)',
      active: pathname === '/' || pathname === '/index' || pathname === '/(tabs)',
    },
    {
      key: 'create',
      icon: 'add-circle-outline',
      label: 'Новая запись',
      sub: 'Текст, фотографии и песня',
      href: '/(tabs)/create',
      active: pathname.includes('/create'),
    },
    {
      key: 'profile',
      icon: 'person-outline',
      label: 'Профиль',
      sub: 'Имя, интересы и аккаунт',
      href: '/(tabs)/profile',
      active: pathname.includes('/profile'),
    },
    {
      key: 'guide',
      icon: 'compass-outline',
      label: 'Как устроен дневник',
      sub: 'Гид и художественные режимы',
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
              paddingBottom: Math.max(insets.bottom, 20) + 12,
              transform: [{ translateX: slideX }],
            },
          ]}
        >
          {/* Шапка меню */}
          <View style={styles.drawerHeader}>
            <View style={styles.drawerBrandCol}>
              <Text style={styles.drawerBrand}>KeepMemory</Text>
              <Text style={styles.drawerTagline}>Дневник атмосферы дня</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.hairline} />

          {/* Навигация */}
          <View style={styles.navList}>
            {navItems.map((item) => (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.78}
                onPress={() => goTo(item.href)}
                style={[styles.navRow, item.active && styles.navRowActive]}
              >
                <View
                  style={[
                    styles.navIconWrap,
                    item.active && styles.navIconWrapActive,
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={19}
                    color={item.active ? THEME.colors.accent : THEME.colors.textMuted}
                  />
                </View>
                <View style={styles.navTextCol}>
                  <Text style={[styles.navLabel, item.active && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                  <Text style={styles.navSub}>{item.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Нижний блок аккаунта */}
          <View style={styles.drawerFooter}>
            <View style={styles.hairline} />
            {authError ? <Text style={styles.authError}>{authError}</Text> : null}
            {authStatus === 'signedOut' ? (
              <View style={styles.authLinks}>
                <TouchableOpacity onPress={() => goTo('/auth/login')} style={styles.authPrimaryBtn}>
                  <Text style={styles.authPrimaryText}>Войти</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => goTo('/auth/register')} style={styles.authSecondaryBtn}>
                  <Text style={styles.authSecondaryText}>Регистрация</Text>
                </TouchableOpacity>
              </View>
            ) : authStatus === 'signedIn' ? (
              <TouchableOpacity onPress={handleLogout} style={styles.logoutRow}>
                <Ionicons name="log-out-outline" size={17} color={THEME.colors.textMuted} />
                <Text style={styles.logoutText}>Выйти из аккаунта</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  menuTrigger: {
    width: 38,
    height: 38,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  menuLineLong: {
    width: 16,
    height: 1.7,
    backgroundColor: THEME.colors.text,
    borderRadius: 2,
  },
  menuLineShort: {
    width: 11,
    height: 1.7,
    backgroundColor: THEME.colors.accent,
    borderRadius: 2,
    alignSelf: 'flex-start',
    marginLeft: 10,
  },
  brandTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 21,
    color: THEME.colors.text,
    letterSpacing: 0.2,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: THEME.radius.pill,
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
    backgroundColor: 'rgba(3, 3, 6, 0.74)',
  },
  drawer: {
    flex: 1,
    backgroundColor: '#0A0A10',
    borderRightWidth: 1,
    borderRightColor: THEME.colors.border,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 18,
  },
  drawerBrandCol: { gap: 4 },
  drawerBrand: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    color: THEME.colors.text,
  },
  drawerTagline: {
    color: THEME.colors.textMuted,
    fontSize: 13,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.pill,
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
    paddingTop: 20,
    gap: 8,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 12,
  },
  navRowActive: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderColor: THEME.colors.border,
  },
  navIconWrap: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navIconWrapActive: {
    backgroundColor: THEME.colors.accentSoft,
  },
  navTextCol: {
    flex: 1,
    gap: 2,
  },
  navLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  navLabelActive: {
    color: THEME.colors.text,
  },
  navSub: {
    fontSize: 12,
    color: THEME.colors.textDim,
  },
  drawerFooter: {
    gap: 14,
  },
  authLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authPrimaryBtn: {
    flex: 1,
    backgroundColor: THEME.colors.accent,
    paddingVertical: 11,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
  },
  authPrimaryText: {
    color: THEME.colors.accentText,
    fontSize: 13,
    fontWeight: '700',
  },
  authSecondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    paddingVertical: 11,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
  },
  authSecondaryText: {
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  logoutText: {
    color: THEME.colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  authError: {
    color: THEME.colors.danger,
    fontSize: 12,
    lineHeight: 17,
  },
});