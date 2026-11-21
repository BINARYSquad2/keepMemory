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
import { Href, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, getDays, getErrorMessage, hasAuthToken } from '../../services/api';
import {
  ArtStyle,
  formatMemoryDate,
  getMemoryPhotos,
  MemoryDay,
} from '../../types/memory';
import { ART_STYLE_META } from '../../constants/artStyles';
import { analyzeDayAtmosphere } from '../../services/atmosphereInterpreter';
import { THEME } from '../../constants/theme';

export default function ArchiveScreen() {
  const router = useRouter();
  const [items, setItems] = useState<MemoryDay[]>([]);
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

  const availableStyles = useMemo(() => {
    const set = new Set<ArtStyle>();
    items.forEach((d) => set.add(d.style.artStyle));
    return Array.from(set);
  }, [items]);

  const totalPhotos = useMemo(
    () => items.reduce((sum, day) => sum + Math.max(1, getMemoryPhotos(day).length), 0),
    [items]
  );

  const filteredItems = useMemo(() => {
    if (selectedStyle === 'all') return items;
    return items.filter((d) => d.style.artStyle === selectedStyle);
  }, [items, selectedStyle]);

  const renderFolder = ({ item, index }: { item: MemoryDay; index: number }) => {
    const [
      bgCol = THEME.colors.bg,
      accentCol = THEME.colors.accent,
      lightCol = THEME.colors.text,
    ] = item.style.palette ?? [];
    const folderNum = String(filteredItems.length - index).padStart(2, '0');
    const isSerif = item.style.typographyVariant === 'serif_editorial';
    const modeMeta = ART_STYLE_META[item.style.artStyle] ?? ART_STYLE_META.analog_film;
    const photos = getMemoryPhotos(item);
    const atmosphere = analyzeDayAtmosphere(item);

    return (
      <TouchableOpacity
        activeOpacity={0.86}
        onPress={() => router.push(`/memory/${item.id}`)}
        style={[
          styles.exhibitCard,
          { backgroundColor: bgCol, borderColor: 'rgba(255,255,255,0.14)' },
        ]}
      >
        {/* Атмосферная обложка дня */}
        <View style={styles.coverWrap}>
          {item.photoUri ? (
            <Image source={{ uri: item.photoUri }} style={styles.coverImage} />
          ) : null}
          <View style={[styles.coverTint, { backgroundColor: accentCol }]} />
          <View style={[styles.coverShade, { backgroundColor: bgCol }]} />

          {/* Верхний ряд: дата + счётчик альбома + палитра */}
          <View style={styles.coverTopRow}>
            <View style={styles.dirPill}>
              <View style={[styles.dirDot, { backgroundColor: accentCol }]} />
              <Text style={styles.dirText}>
                #{folderNum} · {formatMemoryDate(item.date)}
              </Text>
            </View>

            <View style={styles.coverRightPills}>
              {photos.length > 1 ? (
                <View style={styles.albumCountPill}>
                  <Ionicons name="images-outline" size={11} color={lightCol} />
                  <Text style={[styles.albumCountText, { color: lightCol }]}>
                    {photos.length}
                  </Text>
                </View>
              ) : null}
              <View style={styles.paletteStrip}>
                {(item.style.palette ?? []).map((hex, i) => (
                  <View key={`${hex}-${i}`} style={[styles.swatch, { backgroundColor: hex }]} />
                ))}
              </View>
            </View>
          </View>

          {/* Нижний ряд поверх обложки: трек + тег настроения */}
          <View style={styles.coverBottomRow}>
            <View style={styles.trackPill}>
              <Ionicons name="musical-notes" size={12} color={accentCol} />
              <Text style={[styles.trackPillText, { color: lightCol }]} numberOfLines={1}>
                {item.track.artist} — {item.track.title}
              </Text>
            </View>
          </View>
        </View>

        {/* Инфо-блок папки */}
        <View style={styles.cardFooter}>
          <View style={styles.moodTagRow}>
            <Text style={[styles.moodTagText, { color: accentCol }]}>
              {atmosphere.moodBadge}
            </Text>
            <Text style={styles.modeMiniCode}>
              {modeMeta.code} // {modeMeta.shortTitle.toUpperCase()}
            </Text>
          </View>

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
            {atmosphere.cardCaption}
          </Text>

          <View style={styles.cardBottomMeta}>
            <Text style={styles.snippetTextPreview} numberOfLines={1}>
              «{item.text}»
            </Text>
            <View style={styles.openHint}>
              <Text style={[styles.openHintText, { color: accentCol }]}>Открыть</Text>
              <Ionicons name="arrow-forward" size={13} color={accentCol} />
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
                  После входа твои папки дней сохраняются и синхронизируются между устройствами.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/auth/login')}
                  style={styles.emptyButton}
                >
                  <Text style={styles.emptyButtonText}>ВОЙТИ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push('/auth/register')}
                  style={styles.emptyLink}
                >
                  <Text style={styles.emptyLinkText}>Создать аккаунт</Text>
                </TouchableOpacity>
              </>
            ) : error ? (
              <>
                <Text style={styles.emptyTitle}>Не удалось загрузить галерею</Text>
                <Text style={styles.emptyText}>{error}</Text>
                <TouchableOpacity onPress={() => void loadDays()} style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>ПОВТОРИТЬ</Text>
                </TouchableOpacity>
              </>
            ) : selectedStyle !== 'all' ? (
              <>
                <Text style={styles.emptyTitle}>В этом стиле пока нет дней</Text>
                <TouchableOpacity
                  onPress={() => setSelectedStyle('all')}
                  style={styles.emptyButton}
                >
                  <Text style={styles.emptyButtonText}>ПОКАЗАТЬ ВСЕ ДНИ</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>Твой архив ждёт первый день</Text>
                <Text style={styles.emptyText}>
                  Напиши пару строк, приложи 1–6 фото и песню — система соберёт первую страницу.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/create')}
                  style={styles.emptyButton}
                >
                  <Text style={styles.emptyButtonText}>ЗАПИСАТЬ ПЕРВЫЙ ДЕНЬ →</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            {/* Хай-тек галерейный Hero-блок */}
            <View style={styles.heroCard}>
              <View style={styles.cornerTL} />
              <View style={styles.cornerBR} />

              <View style={styles.heroTopRow}>
                <Text style={styles.heroEyebrow}>• ARCHIVE.EXE // ARTTECH_DIARY</Text>
                <TouchableOpacity
                  onPress={() => router.push('/guide' as Href)}
                  style={styles.guideChip}
                  activeOpacity={0.8}
                >
                  <Ionicons name="compass-outline" size={13} color={THEME.colors.accent} />
                  <Text style={styles.guideChipText}>Гид</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.heroTitle}>Атмосфера твоих дней_</Text>
              <Text style={styles.heroSub}>
                Каждый день собран из текста, альбома фото и саундтрека в единой визуальной системе.
              </Text>

              {/* Телеметрия архива */}
              <View style={styles.telemetryStrip}>
                <View style={styles.telemetryCell}>
                  <Text style={styles.telemetryNum}>
                    {String(items.length).padStart(2, '0')}
                  </Text>
                  <Text style={styles.telemetryLabel}>ПАПОК</Text>
                </View>
                <View style={styles.telemetryDiv} />
                <View style={styles.telemetryCell}>
                  <Text style={styles.telemetryNum}>
                    {String(totalPhotos).padStart(2, '0')}
                  </Text>
                  <Text style={styles.telemetryLabel}>КАДРОВ</Text>
                </View>
                <View style={styles.telemetryDiv} />
                <View style={styles.telemetryCell}>
                  <Text style={styles.telemetryNum}>
                    {String(availableStyles.length).padStart(2, '0')}/04
                  </Text>
                  <Text style={styles.telemetryLabel}>РЕЖИМОВ</Text>
                </View>
              </View>
            </View>

            {/* Фильтр по визуальным режимам */}
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
                  const meta = ART_STYLE_META[st] ?? ART_STYLE_META.analog_film;
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
                        {meta.code} · {meta.shortTitle}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}

            <View style={styles.sectionDivider}>
              <Text style={styles.sectionLabel}>
                01 // СОХРАНЁННЫЕ ПАПКИ ({filteredItems.length})
              </Text>
              <TouchableOpacity onPress={() => router.push('/guide' as Href)}>
                <Text style={styles.sectionGuideLink}>Как работает система →</Text>
              </TouchableOpacity>
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
    paddingBottom: 44,
  },
  headerBlock: { gap: 14, marginBottom: 2 },
  heroCard: {
    position: 'relative',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.radius.md,
    padding: 16,
    gap: 8,
  },
  cornerTL: {
    position: 'absolute',
    top: -1,
    left: -1,
    width: 14,
    height: 14,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: THEME.colors.accent,
    borderTopLeftRadius: THEME.radius.md,
  },
  cornerBR: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: THEME.colors.warmGold,
    borderBottomRightRadius: THEME.radius.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  heroEyebrow: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: THEME.colors.accent,
  },
  guideChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  guideChipText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    color: THEME.colors.text,
  },
  heroTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 27,
    color: THEME.colors.text,
    lineHeight: 33,
  },
  heroSub: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  telemetryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfacePanel,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.sm,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  telemetryCell: { flex: 1, alignItems: 'center', gap: 1 },
  telemetryDiv: {
    width: 1,
    height: 22,
    backgroundColor: THEME.colors.border,
  },
  telemetryNum: {
    fontFamily: THEME.fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  telemetryLabel: {
    fontFamily: THEME.fonts.mono,
    fontSize: 8,
    letterSpacing: 1,
    color: THEME.colors.textDim,
  },
  filterRow: { gap: 8, paddingVertical: 2 },
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
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
  filterChipTextActive: {
    color: THEME.colors.accent,
    fontWeight: '700',
  },
  sectionDivider: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingBottom: 8,
  },
  sectionLabel: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: THEME.colors.textDim,
  },
  sectionGuideLink: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    color: THEME.colors.warmGold,
  },
  exhibitCard: {
    borderWidth: 1,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
  },
  coverWrap: {
    height: 192,
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
    height: 92,
    opacity: 0.68,
  },
  coverTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  coverRightPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dirPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6, 6, 9, 0.76)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.pill,
  },
  dirDot: { width: 6, height: 6, borderRadius: 99 },
  dirText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: THEME.colors.text,
  },
  albumCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6, 6, 9, 0.76)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.xs,
  },
  albumCountText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
  },
  paletteStrip: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(6, 6, 9, 0.68)',
    padding: 5,
    borderRadius: THEME.radius.xs,
  },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  coverBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6, 6, 9, 0.78)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.pill,
    maxWidth: '92%',
  },
  trackPillText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
  },
  cardFooter: {
    padding: 16,
    gap: 8,
  },
  moodTagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  moodTagText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  modeMiniCode: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    color: 'rgba(244, 239, 230, 0.45)',
  },
  folderTitle: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  snippet: {
    color: 'rgba(244, 239, 230, 0.72)',
    fontSize: 12,
    lineHeight: 18,
  },
  cardBottomMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  snippetTextPreview: {
    flex: 1,
    fontFamily: THEME.fonts.serif,
    fontSize: 12,
    color: 'rgba(244, 239, 230, 0.54)',
  },
  openHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  openHintText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
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
    paddingVertical: 11,
    backgroundColor: THEME.colors.accentSoft,
  },
  emptyButtonText: {
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.accent,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  emptyLink: { padding: 6 },
  emptyLinkText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
});