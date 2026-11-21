import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, getDays, getErrorMessage, hasAuthToken } from '../../services/api';
import { ArtStyle, formatMemoryDate, MemoryDay } from '../../types/memory';
import { ART_STYLE_META } from '../../constants/artStyles';
import { THEME } from '../../constants/theme';

export default function ArchiveScreen() {
  const router = useRouter();
  const [items, setItems] = useState<MemoryDay[]>([]);
  const [guideOpen, setGuideOpen] = useState<boolean | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<ArtStyle | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDays = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsAuth(false);
    try {
      if (!(await hasAuthToken())) {
        setItems([]);
        setNeedsAuth(true);
        return;
      }

      const days = await getDays();
      setItems(days);
      setNeedsAuth(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setNeedsAuth(requestError instanceof ApiError && requestError.status === 401);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDays();
    }, [loadDays])
  );

  // По умолчанию гид открыт, пока архив пуст; но кнопка «Гид» всегда может его открыть/скрыть
  const isGuideVisible = guideOpen === null ? items.length === 0 : guideOpen;

  const availableStyles = useMemo(() => {
    const set = new Set<ArtStyle>();
    items.forEach((d) => set.add(d.style.artStyle));
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    if (selectedStyle === 'all') return items;
    return items.filter((d) => d.style.artStyle === selectedStyle);
  }, [items, selectedStyle]);

  const renderFolder = ({ item, index }: { item: MemoryDay; index: number }) => {
    const [bgCol, accentCol, lightCol] = item.style.palette;
    const folderNum = String(filteredItems.length - index).padStart(2, '0');
    const isSerif = item.style.typographyVariant === 'serif_editorial';
    const modeMeta = ART_STYLE_META[item.style.artStyle];

    return (
      <TouchableOpacity
        activeOpacity={0.86}
        onPress={() => router.push(`/memory/${item.id}`)}
        style={[
          styles.exhibitCard,
          { backgroundColor: bgCol, borderColor: 'rgba(255,255,255,0.12)' },
        ]}
      >
        {/* Крупная атмосферная обложка дня */}
        <View style={styles.coverWrap}>
          {item.photoUri ? (
            <Image source={{ uri: item.photoUri }} style={styles.coverImage} />
          ) : null}
          <View style={[styles.coverTint, { backgroundColor: accentCol }]} />
          <View style={[styles.coverShade, { backgroundColor: bgCol }]} />

          {/* Верхний ярлык папки поверх обложки */}
          <View style={styles.coverTopRow}>
            <View style={styles.dirPill}>
              <View style={[styles.dirDot, { backgroundColor: accentCol }]} />
              <Text style={styles.dirText}>
                День {folderNum} · {formatMemoryDate(item.date)}
              </Text>
            </View>
            <View style={styles.paletteStrip}>
              {item.style.palette.map((hex, i) => (
                <View key={`${hex}-${i}`} style={[styles.swatch, { backgroundColor: hex }]} />
              ))}
            </View>
          </View>

          {/* Бейдж трека внизу обложки */}
          <View style={styles.trackPill}>
            <Ionicons name="musical-notes" size={12} color={accentCol} />
            <Text style={[styles.trackPillText, { color: lightCol }]} numberOfLines={1}>
              {item.track.artist} — {item.track.title}
            </Text>
          </View>
        </View>

        {/* Инфо-блок папки */}
        <View style={styles.cardFooter}>
          <Text
            style={[
              styles.folderTitle,
              { color: lightCol },
              isSerif && { fontFamily: THEME.fonts.serif },
            ]}
            numberOfLines={2}
          >
            {item.folderTitle}
          </Text>

          <Text style={styles.snippet} numberOfLines={2}>
            {item.text}
          </Text>

          <View style={styles.cardBottomMeta}>
            <Text style={[styles.modeBadge, { color: accentCol }]}>
              {modeMeta.code} · {modeMeta.shortTitle.toUpperCase()}
            </Text>
            <View style={styles.openHint}>
              <Text style={styles.openHintText}>Открыть день</Text>
              <Ionicons name="arrow-forward" size={14} color={THEME.colors.textMuted} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderFolder}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void loadDays()}
            tintColor={THEME.colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {loading ? (
              <ActivityIndicator color={THEME.colors.accent} />
            ) : needsAuth ? (
              <>
                <Text style={styles.emptyTitle}>Войди в личный дневник</Text>
                <Text style={styles.emptyText}>
                  После входа все твои папки дней сохраняются и синхронизируются между устройствами.
                </Text>
                <TouchableOpacity onPress={() => router.push('/auth/login')} style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>Войти</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/auth/register')} style={styles.emptyLink}>
                  <Text style={styles.emptyLinkText}>Создать аккаунт</Text>
                </TouchableOpacity>
              </>
            ) : error ? (
              <>
                <Text style={styles.emptyTitle}>Не удалось загрузить галерею</Text>
                <Text style={styles.emptyText}>{error}</Text>
                <TouchableOpacity onPress={() => void loadDays()} style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>Повторить</Text>
                </TouchableOpacity>
              </>
            ) : selectedStyle !== 'all' ? (
              <>
                <Text style={styles.emptyTitle}>В этом стиле пока нет дней</Text>
                <TouchableOpacity onPress={() => setSelectedStyle('all')} style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>Показать все дни</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>Твой архив ещё ждёт первый день</Text>
                <Text style={styles.emptyText}>
                  Опиши любимый день, приложи фото и песню — система соберёт первую страницу.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/create')}
                  style={styles.emptyButton}
                >
                  <Text style={styles.emptyButtonText}>Записать первый день</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            {/* Заголовок галереи */}
            <View style={styles.heroRow}>
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroEyebrow}>ЛИЧНЫЙ АРТ-ДНЕВНИК</Text>
                <Text style={styles.heroTitle}>Атмосфера твоих дней</Text>
              </View>
              <TouchableOpacity
                onPress={() => setGuideOpen(!isGuideVisible)}
                style={[styles.helpChip, isGuideVisible && styles.helpChipActive]}
              >
                <Ionicons
                  name="help-circle-outline"
                  size={16}
                  color={THEME.colors.accent}
                />
                <Text style={styles.helpChipText}>Гид</Text>
              </TouchableOpacity>
            </View>

            {/* Понятный онбординг с первого взгляда */}
            {isGuideVisible && (
              <View style={styles.guideCard}>
                <View style={styles.guideHeader}>
                  <Text style={styles.guideTitle}>КАК СОХРАНИТЬ ДЕНЬ ЗА 30 СЕКУНД</Text>
                  <TouchableOpacity onPress={() => setGuideOpen(false)}>
                    <Text style={styles.guideClose}>Скрыть</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.stepsRow}>
                  <View style={styles.stepItem}>
                    <Text style={styles.stepNum}>01</Text>
                    <Text style={styles.stepLabel}>Напиши пару строк о дне</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <Text style={styles.stepNum}>02</Text>
                    <Text style={styles.stepLabel}>Приложи фото и песню</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <Text style={styles.stepNum}>03</Text>
                    <Text style={styles.stepLabel}>Получи арт-папку в архиве</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.guideCta}
                  onPress={() => router.push('/(tabs)/create')}
                >
                  <Text style={styles.guideCtaText}>Записать новый день →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Фильтр по визуальным режимам, когда в ленте больше 1 стиля */}
            {availableStyles.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                <TouchableOpacity
                  onPress={() => setSelectedStyle('all')}
                  style={[styles.filterChip, selectedStyle === 'all' && styles.filterChipActive]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedStyle === 'all' && styles.filterChipTextActive,
                    ]}
                  >
                    Все ({items.length})
                  </Text>
                </TouchableOpacity>
                {availableStyles.map((st) => {
                  const active = selectedStyle === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      onPress={() => setSelectedStyle(st)}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          active && styles.filterChipTextActive,
                        ]}
                      >
                        {ART_STYLE_META[st].shortTitle}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}

            <View style={styles.sectionDivider}>
              <Text style={styles.sectionLabel}>
                СОХРАНЁННЫЕ ПАПКИ ({filteredItems.length})
              </Text>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  list: {
    padding: THEME.spacing.md,
    gap: 18,
    paddingBottom: 40,
  },
  headerBlock: { gap: 14, marginBottom: 4 },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTextWrap: { flex: 1, gap: 4 },
  heroEyebrow: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: THEME.colors.accent,
  },
  heroTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 28,
    color: THEME.colors.text,
    lineHeight: 34,
  },
  helpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: THEME.colors.surface,
  },
  helpChipActive: {
    borderColor: THEME.colors.accent,
    backgroundColor: THEME.colors.accentSoft,
  },
  helpChipText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.text,
  },
  guideCard: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.radius.md,
    padding: 16,
    gap: 14,
  },
  guideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  guideTitle: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.1,
    color: THEME.colors.textMuted,
  },
  guideClose: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.textDim,
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepItem: {
    flex: 1,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.radius.sm,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  stepNum: {
    fontFamily: THEME.fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.accent,
  },
  stepLabel: {
    color: THEME.colors.text,
    fontSize: 12,
    lineHeight: 16,
  },
  guideCta: {
    backgroundColor: THEME.colors.accentSoft,
    borderWidth: 1,
    borderColor: THEME.colors.accent,
    borderRadius: THEME.radius.sm,
    paddingVertical: 11,
    alignItems: 'center',
  },
  guideCtaText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.accent,
  },
  filterRow: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    backgroundColor: THEME.colors.surface,
  },
  filterChipActive: {
    borderColor: THEME.colors.accent,
    backgroundColor: THEME.colors.accentSoft,
  },
  filterChipText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  filterChipTextActive: {
    color: THEME.colors.accent,
    fontWeight: '700',
  },
  sectionDivider: {
    paddingTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: THEME.colors.textDim,
  },
  exhibitCard: {
    borderWidth: 1,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
  },
  coverWrap: {
    height: 185,
    position: 'relative',
    justifyContent: 'space-between',
    padding: 12,
  },
  coverImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  coverTint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.22,
  },
  coverShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
    opacity: 0.65,
  },
  coverTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dirPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(7, 7, 10, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.pill,
  },
  dirDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
  },
  dirText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: THEME.colors.text,
  },
  paletteStrip: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(7, 7, 10, 0.65)',
    padding: 5,
    borderRadius: THEME.radius.xs,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  trackPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(7, 7, 10, 0.76)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.pill,
    maxWidth: '90%',
  },
  trackPillText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
  },
  cardFooter: {
    padding: 16,
    gap: 8,
  },
  folderTitle: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  snippet: {
    color: 'rgba(244, 239, 230, 0.68)',
    fontSize: 13,
    lineHeight: 19,
  },
  cardBottomMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  modeBadge: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  openHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  openHintText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 28,
    paddingHorizontal: 10,
  },
  emptyTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    color: THEME.colors.text,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },
  emptyButton: {
    borderWidth: 1,
    borderColor: THEME.colors.accent,
    borderRadius: THEME.radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: THEME.colors.accentSoft,
  },
  emptyButtonText: {
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  emptyLink: { padding: 6 },
  emptyLinkText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
});