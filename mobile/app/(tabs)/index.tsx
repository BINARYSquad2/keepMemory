import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  SectionList,
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
import {
  getMemoryPhotos,
  MemoryDay,
} from '../../types/memory';
import { ART_STYLE_META } from '../../constants/artStyles';
import {
  analyzeDayAtmosphere,
  DayAtmosphereReading,
} from '../../services/atmosphereInterpreter';
import { THEME } from '../../constants/theme';

type MoodFilter = 'all' | 'happy' | 'warm' | 'calm' | 'energetic' | 'sad';

const MOOD_FILTERS: Array<{ key: MoodFilter; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'happy', label: 'Весёлое' },
  { key: 'warm', label: 'Тёплое' },
  { key: 'calm', label: 'Спокойное' },
  { key: 'energetic', label: 'Энергичное' },
  { key: 'sad', label: 'Грустное' },
];

const MOOD_LABELS: Record<Exclude<MoodFilter, 'all'>, string> = {
  happy: 'Весёлое',
  warm: 'Тёплое',
  calm: 'Спокойное',
  energetic: 'Энергичное',
  sad: 'Грустное',
};

interface EnrichedDay {
  day: MemoryDay;
  photosCount: number;
  atmosphere: DayAtmosphereReading;
  mood: Exclude<MoodFilter, 'all'>;
  searchable: string;
}

interface WeekSection {
  key: string;
  title: string;
  rangeLabel: string;
  data: EnrichedDay[];
}

function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value?.trim() ?? '');
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = (d.getDay() + 6) % 7; // Пн = 0, Вс = 6
  d.setDate(d.getDate() - dayOfWeek);
  return d;
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const nowYear = new Date().getFullYear();

  const sameMonth =
    monday.getMonth() === sunday.getMonth() &&
    monday.getFullYear() === sunday.getFullYear();

  const startDay = monday.getDate();
  const endDay = sunday.getDate();

  if (sameMonth) {
    const monthName = sunday.toLocaleDateString('ru-RU', { month: 'long' });
    const yearSuffix = sunday.getFullYear() !== nowYear ? ` ${sunday.getFullYear()}` : '';
    return `${startDay}–${endDay} ${monthName}${yearSuffix}`;
  }

  const startMonth = monday.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '');
  const endMonth = sunday.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '');
  const yearSuffix = sunday.getFullYear() !== nowYear ? ` ${sunday.getFullYear()}` : '';
  return `${startDay} ${startMonth} – ${endDay} ${endMonth}${yearSuffix}`;
}

function getWeekBucket(dateStr: string): { key: string; title: string; rangeLabel: string; sortKey: number } {
  const date = parseLocalDate(dateStr);
  if (!date) {
    return { key: 'unknown', title: 'Без даты', rangeLabel: '', sortKey: 0 };
  }

  const monday = startOfWeekMonday(date);
  const currentMonday = startOfWeekMonday(new Date());
  const diffDays = Math.round(
    (currentMonday.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24)
  );

  const rangeLabel = formatWeekRange(monday);
  const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(
    monday.getDate()
  ).padStart(2, '0')}`;

  if (diffDays === 0) {
    return { key, title: 'Эта неделя', rangeLabel, sortKey: monday.getTime() };
  }
  if (diffDays === 7) {
    return { key, title: 'Прошлая неделя', rangeLabel, sortKey: monday.getTime() };
  }
  return {
    key,
    title: rangeLabel.charAt(0).toUpperCase() + rangeLabel.slice(1),
    rangeLabel: '',
    sortKey: monday.getTime(),
  };
}

function formatCardDate(value: string): string {
  const date = parseLocalDate(value);
  if (!date) return value;

  const formatted = date.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function classifyMood(
  day: MemoryDay,
  atmosphere: DayAtmosphereReading
): Exclude<MoodFilter, 'all'> {
  // Поддержка будущего поля mood от ИИ на бэкенде
  const serverMood = (day as MemoryDay & { mood?: string }).mood?.toLowerCase();
  if (
    serverMood === 'happy' ||
    serverMood === 'warm' ||
    serverMood === 'calm' ||
    serverMood === 'energetic' ||
    serverMood === 'sad'
  ) {
    return serverMood;
  }

  const combined = `${day.text} ${day.folderTitle}`.toLowerCase();
  const badge = atmosphere.moodBadge.toUpperCase();
  const energy = day.track.energy ?? 0.5;

  if (
    /груст|тоск|плак|тяжел|тяжёл|устал|один|пуст|боль|печал|дожд|пасмур/.test(combined) ||
    badge.includes('МЕЛАНХОЛИЯ') ||
    badge.includes('ТИХАЯ ПАУЗА')
  ) {
    return 'sad';
  }

  if (
    /радост|счаст|смех|смея|весел|весё|праздн|улыб|круто|восторг|побед|друз/.test(combined) ||
    badge.includes('ЖИВОЕ ПРИСУТСТВИЕ') ||
    badge.includes('УТРЕННЯЯ ЯСНОСТЬ')
  ) {
    return 'happy';
  }

  if (
    /драйв|бег|спорт|тренир|концерт|танц|дедлайн|сдач|проект|офис|код|срочн|энерг/.test(combined) ||
    badge.includes('ДРАЙВ') ||
    badge.includes('ФОКУС') ||
    badge.includes('ИМПУЛЬС') ||
    day.style.artStyle === 'kinetic_zine' ||
    energy >= 0.72
  ) {
    return 'energetic';
  }

  if (
    /какао|кофе|чай|уют|тепл|тёпл|дом|прогул|гуля|парк|обнят|разговор|девушк|семь/.test(combined) ||
    badge.includes('УЮТ') ||
    badge.includes('ТЁПЛОЕ') ||
    badge.includes('ПРОГУЛКИ') ||
    day.style.artStyle === 'analog_film'
  ) {
    return 'warm';
  }

  return 'calm';
}

function pluralDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} запись`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} записи`;
  return `${count} записей`;
}

export default function ArchiveScreen() {
  const router = useRouter();
  const [items, setItems] = useState<MemoryDay[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMood, setSelectedMood] = useState<MoodFilter>('all');
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

  const enrichedItems = useMemo<EnrichedDay[]>(() => {
    return items.map((day) => {
      const atmosphere = analyzeDayAtmosphere(day);
      const mood = classifyMood(day, atmosphere);
      const photosCount = Math.max(1, getMemoryPhotos(day).length);
      const searchable = [
        day.folderTitle,
        day.text,
        day.track.title,
        day.track.artist,
        day.track.genre,
        day.date,
        formatCardDate(day.date),
        MOOD_LABELS[mood],
        atmosphere.moodBadge,
      ]
        .join(' ')
        .toLowerCase();

      return { day, photosCount, atmosphere, mood, searchable };
    });
  }, [items]);

  const moodCounts = useMemo(() => {
    const counts: Record<MoodFilter, number> = {
      all: enrichedItems.length,
      happy: 0,
      warm: 0,
      calm: 0,
      energetic: 0,
      sad: 0,
    };
    enrichedItems.forEach((entry) => {
      counts[entry.mood] += 1;
    });
    return counts;
  }, [enrichedItems]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return enrichedItems.filter((entry) => {
      if (selectedMood !== 'all' && entry.mood !== selectedMood) {
        return false;
      }
      if (query && !entry.searchable.includes(query)) {
        return false;
      }
      return true;
    });
  }, [enrichedItems, selectedMood, searchQuery]);

  const sections = useMemo<WeekSection[]>(() => {
    const map = new Map<string, WeekSection & { sortKey: number }>();

    filteredItems.forEach((entry) => {
      const bucket = getWeekBucket(entry.day.date);
      const existing = map.get(bucket.key);
      if (existing) {
        existing.data.push(entry);
      } else {
        map.set(bucket.key, {
          key: bucket.key,
          title: bucket.title,
          rangeLabel: bucket.rangeLabel,
          sortKey: bucket.sortKey,
          data: [entry],
        });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.sortKey - a.sortKey)
      .map(({ sortKey: _s, ...section }) => ({
        ...section,
        data: [...section.data].sort((a, b) =>
          (b.day.date || b.day.createdAt).localeCompare(a.day.date || a.day.createdAt)
        ),
      }));
  }, [filteredItems]);

  const hasActiveFilters = selectedMood !== 'all' || searchQuery.trim().length > 0;

  const renderFolder = ({ item }: { item: EnrichedDay }) => {
    const { day, photosCount, atmosphere, mood } = item;
    const [
      bgCol = THEME.colors.bg,
      accentCol = THEME.colors.accent,
      lightCol = THEME.colors.text,
    ] = day.style.palette ?? [];
    const isSerif = day.style.typographyVariant === 'serif_editorial';
    const modeMeta = ART_STYLE_META[day.style.artStyle] ?? ART_STYLE_META.analog_film;

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => router.push(`/memory/${day.id}`)}
        style={[
          styles.card,
          { backgroundColor: bgCol, borderColor: 'rgba(255,255,255,0.12)' },
        ]}
      >
        <View style={styles.coverWrap}>
          {day.photoUri ? (
            <Image source={{ uri: day.photoUri }} style={styles.coverImage} />
          ) : null}
          <View style={[styles.coverTint, { backgroundColor: accentCol }]} />
          <View style={[styles.coverShade, { backgroundColor: bgCol }]} />

          <View style={styles.coverTopRow}>
            <View style={styles.datePill}>
              <View style={[styles.dateDot, { backgroundColor: accentCol }]} />
              <Text style={styles.dateText}>{formatCardDate(day.date)}</Text>
            </View>

            <View style={styles.coverRightPills}>
              {photosCount > 1 ? (
                <View style={styles.albumPill}>
                  <Ionicons name="images-outline" size={12} color={lightCol} />
                  <Text style={[styles.albumPillText, { color: lightCol }]}>
                    {photosCount}
                  </Text>
                </View>
              ) : null}
              <View style={styles.paletteStrip}>
                {(day.style.palette ?? []).map((hex, i) => (
                  <View key={`${hex}-${i}`} style={[styles.swatch, { backgroundColor: hex }]} />
                ))}
              </View>
            </View>
          </View>

          <View style={styles.trackPill}>
            <Ionicons name="musical-notes" size={12} color={accentCol} />
            <Text style={[styles.trackPillText, { color: lightCol }]} numberOfLines={1}>
              {day.track.artist} — {day.track.title}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.metaRow}>
            <Text style={[styles.moodLabel, { color: accentCol }]}>
              {MOOD_LABELS[mood]}
            </Text>
            <Text style={styles.styleLabel}>{modeMeta.shortTitle}</Text>
          </View>

          <Text
            style={[
              styles.folderTitle,
              { color: lightCol },
              isSerif && { fontFamily: THEME.fonts.serif },
            ]}
            numberOfLines={2}
          >
            {day.folderTitle}
          </Text>

          <Text style={styles.caption} numberOfLines={2}>
            {atmosphere.cardCaption}
          </Text>

          <View style={styles.cardFooter}>
            <Text style={styles.excerpt} numberOfLines={1}>
              {day.text}
            </Text>
            <View style={styles.openRow}>
              <Text style={[styles.openText, { color: accentCol }]}>Открыть</Text>
              <Ionicons name="arrow-forward" size={14} color={accentCol} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(entry) => entry.day.id}
        renderItem={renderFolder}
        renderSectionHeader={({ section }) => (
          <View style={styles.weekHeader}>
            <View style={styles.weekTitleWrap}>
              <Text style={styles.weekTitle}>{section.title}</Text>
              {section.rangeLabel ? (
                <Text style={styles.weekRange}>{section.rangeLabel}</Text>
              ) : null}
            </View>
            <Text style={styles.weekCount}>{pluralDays(section.data.length)}</Text>
          </View>
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void loadDays()}
            tintColor={THEME.colors.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.titleBlock}>
              <Text style={styles.pageTitle}>Дневник дней</Text>
              <Text style={styles.pageSubtitle}>
                {items.length > 0
                  ? `${pluralDays(items.length)} в вашем архиве`
                  : 'Сохраняйте настроение дня через слова, фото и музыку'}
              </Text>
            </View>

            {/* Поиск и фильтрация по эмоциям */}
            {items.length > 0 ? (
              <View style={styles.controlsBlock}>
                <View style={styles.searchWrap}>
                  <Ionicons name="search-outline" size={17} color={THEME.colors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Поиск по записям, названиям, песням…"
                    placeholderTextColor={THEME.colors.textDim}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                  />
                  {searchQuery.length > 0 ? (
                    <TouchableOpacity
                      onPress={() => setSearchQuery('')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={17} color={THEME.colors.textDim} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.moodRow}
                >
                  {MOOD_FILTERS.map((filter) => {
                    const active = selectedMood === filter.key;
                    const count = moodCounts[filter.key];
                    return (
                      <TouchableOpacity
                        key={filter.key}
                        onPress={() => setSelectedMood(filter.key)}
                        activeOpacity={0.8}
                        style={[styles.moodChip, active && styles.moodChipActive]}
                      >
                        <Text
                          style={[
                            styles.moodChipText,
                            active && styles.moodChipTextActive,
                          ]}
                        >
                          {filter.label}
                          {count > 0 ? ` · ${count}` : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {hasActiveFilters ? (
                  <View style={styles.filterSummaryRow}>
                    <Text style={styles.filterSummaryText}>
                      Показано: {pluralDays(filteredItems.length)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setSearchQuery('');
                        setSelectedMood('all');
                      }}
                    >
                      <Text style={styles.resetFilterText}>Сбросить</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {loading ? (
              <ActivityIndicator color={THEME.colors.accent} />
            ) : needsAuth ? (
              <>
                <Text style={styles.emptyTitle}>Войдите в свой дневник</Text>
                <Text style={styles.emptyText}>
                  После входа все ваши записи и альбомы сохраняются и доступны с любого устройства.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/auth/login')}
                  style={styles.emptyButton}
                >
                  <Text style={styles.emptyButtonText}>Войти</Text>
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
                <Text style={styles.emptyTitle}>Не удалось загрузить дневник</Text>
                <Text style={styles.emptyText}>{error}</Text>
                <TouchableOpacity onPress={() => void loadDays()} style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>Повторить</Text>
                </TouchableOpacity>
              </>
            ) : hasActiveFilters ? (
              <>
                <Text style={styles.emptyTitle}>Ничего не нашлось</Text>
                <Text style={styles.emptyText}>
                  Попробуйте изменить запрос или выбрать другое настроение.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedMood('all');
                  }}
                  style={styles.emptyButton}
                >
                  <Text style={styles.emptyButtonText}>Показать все записи</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>Здесь появятся ваши дни</Text>
                <Text style={styles.emptyText}>
                  Напишите пару строк о сегодняшнем дне, добавьте фото и песню — дневник соберёт первую страницу.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/create')}
                  style={styles.emptyButton}
                >
                  <Text style={styles.emptyButtonText}>Создать первую запись</Text>
                </TouchableOpacity>
              </>
            )}
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
    paddingBottom: 48,
  },
  headerBlock: {
    gap: 16,
    marginBottom: 8,
  },
  titleBlock: {
    gap: 4,
    paddingTop: 2,
  },
  pageTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 30,
    color: THEME.colors.text,
    lineHeight: 36,
  },
  pageSubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    lineHeight: 19,
  },
  controlsBlock: {
    gap: 10,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    color: THEME.colors.text,
    fontSize: 14,
    paddingVertical: 12,
  },
  moodRow: {
    gap: 8,
    paddingVertical: 2,
  },
  moodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  moodChipActive: {
    borderColor: THEME.colors.accent,
    backgroundColor: THEME.colors.accentSoft,
  },
  moodChipText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  moodChipTextActive: {
    color: THEME.colors.accent,
    fontWeight: '600',
  },
  filterSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  filterSummaryText: {
    fontSize: 12,
    color: THEME.colors.textDim,
  },
  resetFilterText: {
    fontSize: 12,
    color: THEME.colors.accent,
    fontWeight: '600',
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 18,
    paddingBottom: 10,
  },
  weekTitleWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flex: 1,
  },
  weekTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 18,
    color: THEME.colors.text,
  },
  weekRange: {
    fontSize: 12,
    color: THEME.colors.textDim,
  },
  weekCount: {
    fontSize: 12,
    color: THEME.colors.textDim,
  },
  card: {
    borderWidth: 1,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
    marginBottom: 16,
  },
  coverWrap: {
    height: 196,
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
    opacity: 0.2,
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
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6, 6, 9, 0.72)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: THEME.radius.pill,
  },
  dateDot: { width: 6, height: 6, borderRadius: 99 },
  dateText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  albumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6, 6, 9, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: THEME.radius.pill,
  },
  albumPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  paletteStrip: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(6, 6, 9, 0.65)',
    padding: 5,
    borderRadius: THEME.radius.xs,
  },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  trackPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6, 6, 9, 0.75)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: THEME.radius.pill,
    maxWidth: '92%',
  },
  trackPillText: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardBody: {
    padding: 16,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  moodLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  styleLabel: {
    fontSize: 11,
    color: 'rgba(244, 239, 230, 0.5)',
  },
  folderTitle: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  caption: {
    color: 'rgba(244, 239, 230, 0.72)',
    fontSize: 13,
    lineHeight: 19,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  excerpt: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(244, 239, 230, 0.52)',
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  openText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 22,
    color: THEME.colors.text,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 4,
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.radius.pill,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: THEME.colors.accentText,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyLink: { padding: 6 },
  emptyLinkText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
  },
});