import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from 'expo-audio';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { ApiError, getDay, getErrorMessage } from '../../services/api';
import {
  formatMemoryDate,
  getMemoryPhotos,
  MemoryDay,
} from '../../types/memory';
import { ART_STYLE_META, TYPOGRAPHY_LABELS } from '../../constants/artStyles';
import { analyzeDayAtmosphere } from '../../services/atmosphereInterpreter';
import { MemoryCanvas } from '../../components/MemoryCanvas';
import { THEME } from '../../constants/theme';

function formatSec(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = String(total % 60).padStart(2, '0');

  return `${mins}:${secs}`;
}

export default function MemoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const cardRef = useRef<React.ComponentRef<typeof View>>(null);

  const [loadedDay, setLoadedDay] = useState<{
    id: string;
    memory: MemoryDay | null;
    error: string | null;
    needsAuth: boolean;
  } | null>(null);

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showSystemDetails, setShowSystemDetails] = useState(true);

  useEffect(() => {
    let active = true;
    setActivePhotoIndex(0);

    if (!id) return;

    void getDay(id)
      .then((day) => {
        if (active) {
          setLoadedDay({
            id,
            memory: day,
            error: null,
            needsAuth: false,
          });
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setLoadedDay({
            id,
            memory: null,
            error: getErrorMessage(requestError),
            needsAuth:
              requestError instanceof ApiError &&
              requestError.status === 401,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  const resultForId = loadedDay?.id === id ? loadedDay : null;

  const memory = resultForId?.memory ?? null;
  const loading = Boolean(id) && resultForId === null;
  const error =
    resultForId?.error ?? (id ? null : 'Не указан идентификатор записи.');
  const needsAuth = resultForId?.needsAuth ?? false;

  const photos = useMemo(
    () => (memory ? getMemoryPhotos(memory) : []),
    [memory]
  );
  const atmosphere = useMemo(
    () => (memory ? analyzeDayAtmosphere(memory) : null),
    [memory]
  );

  const previewUrl = memory?.track.previewUrl || '';
  const player = useAudioPlayer(previewUrl || null);
  const status = useAudioPlayerStatus(player);
  const isPlaying = Boolean(previewUrl) && status.playing;

  useEffect(() => {
    let active = true;

    if (previewUrl) {
      player.loop = true;
    }

    void setAudioModeAsync({
      playsInSilentMode: true,
    }).catch((audioModeError: unknown) => {
      if (active) {
        setAudioError(getErrorMessage(audioModeError));
      }
    });

    return () => {
      active = false;
    };
  }, [player, previewUrl]);

  const togglePlay = () => {
    if (!memory) return;

    if (!previewUrl) {
      setAudioError('У этого трека нет доступного 30-секундного фрагмента.');
      return;
    }

    setAudioError(null);

    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const openTrackExternal = () => {
    const url = memory?.track.trackUrl;
    if (!url) return;

    void Linking.openURL(url).catch(() => {
      setAudioError('Не удалось открыть ссылку на трек.');
    });
  };

  const handleExportCard = async () => {
    if (!memory || exporting) return;

    if (Platform.OS === 'web') {
      setExportError(
        'Сохранение PNG-открытки доступно на телефоне (iOS / Android).'
      );
      return;
    }

    try {
      setExporting(true);
      setExportError(null);

      if (!cardRef.current) {
        throw new Error('Не удалось найти открытку для сохранения.');
      }

      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        setExportError(
          'Системное меню сохранения недоступно на этом устройстве.'
        );
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: memory.folderTitle,
      });
    } catch (err) {
      setExportError(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={THEME.colors.accent} />
          <Text style={styles.loadingText}>Открываем папку дня…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!memory || !atmosphere) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {error || 'Запись не найдена.'}
          </Text>

          {needsAuth ? (
            <TouchableOpacity onPress={() => router.push('/auth/login')}>
              <Text style={styles.backLink}>Войти в аккаунт</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>← Вернуться в галерею</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const [
    ,
    accentCol = THEME.colors.accent,
    lightCol = THEME.colors.text,
  ] = memory.style.palette ?? [];
  const modeMeta =
    ART_STYLE_META[memory.style.artStyle] ?? ART_STYLE_META.analog_film;

  const progressRatio =
    status.duration > 0
      ? Math.min(1, Math.max(0, status.currentTime / status.duration))
      : 0;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Шапка страницы */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(tabs)')
          }
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={18} color={THEME.colors.text} />
          <Text style={styles.backText}>Галерея</Text>
        </TouchableOpacity>

        <View style={styles.topRight}>
          <Text style={styles.topTag}>[FOLDER.EXE]</Text>
          <Text style={styles.topDate}>{formatMemoryDate(memory.date)}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Визуальное воспоминание */}
        <View ref={cardRef} collapsable={false} style={styles.captureWrap}>
          <MemoryCanvas
            memory={memory}
            isPlaying={isPlaying}
            activePhotoIndex={activePhotoIndex}
            onSelectPhoto={setActivePhotoIndex}
          />
        </View>

        {/* Лента альбома, если в дне несколько фотографий */}
        {photos.length > 1 ? (
          <View style={styles.albumCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardEyebrow}>
                01 // АЛЬБОМ ДНЯ ({photos.length} КАДРОВ)
              </Text>
              <Text style={[styles.tempoPill, { color: accentCol }]}>
                КАДР 0{activePhotoIndex + 1} / 0{photos.length}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filmstrip}
            >
              {photos.map((uri, idx) => {
                const active = idx === activePhotoIndex;
                return (
                  <TouchableOpacity
                    key={`${uri}-${idx}`}
                    onPress={() => setActivePhotoIndex(idx)}
                    activeOpacity={0.82}
                    style={[
                      styles.thumbItem,
                      active && { borderColor: accentCol, borderWidth: 2 },
                    ]}
                  >
                    <Image source={{ uri }} style={styles.thumbImg} />
                    <View style={styles.thumbNumBadge}>
                      <Text
                        style={[
                          styles.thumbNumText,
                          active && { color: accentCol },
                        ]}
                      >
                        0{idx + 1}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Кнопка экспорта PNG */}
        <TouchableOpacity
          onPress={handleExportCard}
          disabled={exporting}
          activeOpacity={0.82}
          style={[
            styles.exportBtn,
            exporting && styles.exportBtnDisabled,
          ]}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={THEME.colors.accent} />
          ) : (
            <Ionicons
              name="share-outline"
              size={16}
              color={THEME.colors.accent}
            />
          )}

          <Text style={styles.exportBtnText}>
            {exporting ? 'СОХРАНЯЕМ ОТКРЫТКУ…' : 'СОХРАНИТЬ ОТКРЫТКУ (PNG)'}
          </Text>
        </TouchableOpacity>

        {exportError ? (
          <Text style={styles.audioError}>{exportError}</Text>
        ) : null}

        {/* Карточка саундтрека дня */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardEyebrow}>САУНДТРЕК ДНЯ</Text>

            <Text style={[styles.tempoPill, { color: accentCol }]}>
              {isPlaying ? '● ЗВУЧИТ' : 'ПАУЗА'} ·{' '}
              {memory.style.motionSpeed.toFixed(1)}x
            </Text>
          </View>

          <View style={styles.playerRow}>
            {memory.track.artworkUrl ? (
              <Image
                source={{ uri: memory.track.artworkUrl }}
                style={styles.artwork}
              />
            ) : (
              <View style={styles.artworkFallback}>
                <Ionicons name="musical-notes" size={20} color={accentCol} />
              </View>
            )}

            <View style={styles.trackMeta}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {memory.track.title}
              </Text>

              <Text style={styles.trackSub} numberOfLines={1}>
                {memory.track.artist} · {memory.track.genre}
              </Text>
            </View>

            <TouchableOpacity
              onPress={togglePlay}
              activeOpacity={0.85}
              style={[
                styles.playBtn,
                { borderColor: accentCol },
                isPlaying && { backgroundColor: accentCol },
              ]}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={20}
                color={isPlaying ? '#07070A' : accentCol}
              />
            </TouchableOpacity>
          </View>

          {previewUrl ? (
            <View style={styles.progressBlock}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progressRatio * 100}%`,
                      backgroundColor: accentCol,
                    },
                  ]}
                />
              </View>

              <View style={styles.progressMeta}>
                <Text style={styles.timeText}>
                  {formatSec(status.currentTime)}
                </Text>
                <Text style={styles.timeText}>
                  {status.duration > 0 ? formatSec(status.duration) : '0:30'}
                </Text>
              </View>
            </View>
          ) : null}

          {memory.track.trackUrl ? (
            <TouchableOpacity
              onPress={openTrackExternal}
              style={styles.externalLink}
            >
              <Text style={[styles.externalLinkText, { color: accentCol }]}>
                Открыть полную версию трека
              </Text>
              <Ionicons name="open-outline" size={14} color={accentCol} />
            </TouchableOpacity>
          ) : null}

          {audioError ? (
            <Text style={styles.audioError}>{audioError}</Text>
          ) : null}
        </View>

        {/* Текст записи */}
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>ЗАПИСЬ ДНЯ</Text>
          <Text style={[styles.entryText, { color: lightCol }]}>
            {memory.text}
          </Text>
        </View>

        {/* Уникальный кураторский разбор конкретного дня */}
        <View style={styles.systemCard}>
          <View style={styles.cornerTL} />
          <View style={styles.cornerBR} />

          <TouchableOpacity
            style={styles.cardHeaderRow}
            onPress={() => setShowSystemDetails((prev) => !prev)}
            activeOpacity={0.75}
          >
            <Text style={styles.cardEyebrow}>
              LOGIC.EXE // ПОЧЕМУ ЭТОТ ДЕНЬ ВЫГЛЯДИТ ТАК
            </Text>
            <Ionicons
              name={showSystemDetails ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={THEME.colors.textMuted}
            />
          </TouchableOpacity>

          <View style={styles.moodHeaderRow}>
            <View style={[styles.moodTag, { borderColor: accentCol }]}>
              <Text style={[styles.moodTagText, { color: accentCol }]}>
                {atmosphere.moodBadge}
              </Text>
            </View>
            <Text style={styles.modeMiniLabel}>{modeMeta.shortTitle}</Text>
          </View>

          <Text style={styles.curatorSummary}>{atmosphere.curatorSummary}</Text>

          {showSystemDetails ? (
            <View style={styles.driversCol}>
              <View style={styles.driverRow}>
                <Text style={styles.driverIndex}>01 // ТЕКСТ</Text>
                <Text style={styles.driverText}>{atmosphere.drivers.text}</Text>
              </View>

              <View style={styles.driverRow}>
                <Text style={styles.driverIndex}>02 // ПАЛИТРА И СВЕТ</Text>
                <Text style={styles.driverText}>
                  {atmosphere.drivers.palette}
                </Text>
              </View>

              <View style={styles.driverRow}>
                <Text style={styles.driverIndex}>03 // МУЗЫКА И РИТМ</Text>
                <Text style={styles.driverText}>
                  {atmosphere.drivers.music}
                </Text>
              </View>

              <View style={styles.driverRow}>
                <Text style={styles.driverIndex}>04 // АЛЬБОМ И ПРИЁМ</Text>
                <Text style={styles.driverText}>
                  {atmosphere.drivers.album}
                </Text>
              </View>

              <View style={styles.metaDivider} />

              <View style={styles.specRow}>
                <Text style={styles.specKey}>Типографика</Text>
                <Text style={styles.specVal}>
                  {TYPOGRAPHY_LABELS[memory.style.typographyVariant] ??
                    memory.style.typographyVariant}
                </Text>
              </View>

              <View style={styles.paletteRow}>
                <Text style={styles.specKey}>Палитра дня</Text>
                <View style={styles.paletteChips}>
                  {(memory.style.palette ?? []).map((hex, idx) => (
                    <View key={`${hex}-${idx}`} style={styles.paletteChip}>
                      <View
                        style={[styles.chipDot, { backgroundColor: hex }]}
                      />
                      <Text style={styles.chipHex}>{hex.toUpperCase()}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.colors.bg },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  loadingText: { color: THEME.colors.textMuted, fontSize: 14 },
  errorText: { color: THEME.colors.text, fontSize: 14, textAlign: 'center' },
  audioError: { color: THEME.colors.danger, fontSize: 12, lineHeight: 18 },
  backLink: {
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.accent,
    fontSize: 13,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingRight: 12,
  },
  backText: {
    fontFamily: THEME.fonts.serif,
    fontSize: 17,
    color: THEME.colors.text,
  },
  topRight: { alignItems: 'flex-end', gap: 1 },
  topTag: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    color: THEME.colors.accent,
  },
  topDate: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  scroll: {
    padding: THEME.spacing.md,
    gap: 16,
    paddingBottom: 48,
  },
  captureWrap: {
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: THEME.colors.bg,
    borderRadius: THEME.radius.md,
  },
  albumCard: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: 14,
    gap: 10,
  },
  filmstrip: { gap: 8 },
  thumbItem: {
    width: 64,
    height: 64,
    borderRadius: THEME.radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  thumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  thumbNumBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(6, 6, 9, 0.78)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  thumbNumText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    color: THEME.colors.text,
    fontWeight: '700',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    backgroundColor: THEME.colors.surface,
  },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: THEME.colors.text,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: 16,
    gap: 12,
  },
  systemCard: {
    position: 'relative',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.radius.md,
    padding: 16,
    gap: 12,
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
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardEyebrow: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: THEME.colors.textDim,
  },
  tempoPill: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: THEME.radius.xs,
  },
  artworkFallback: {
    width: 48,
    height: 48,
    borderRadius: THEME.radius.xs,
    backgroundColor: THEME.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackMeta: { flex: 1, gap: 3 },
  trackTitle: { color: THEME.colors.text, fontSize: 15, fontWeight: '700' },
  trackSub: { color: THEME.colors.textMuted, fontSize: 12 },
  playBtn: {
    width: 44,
    height: 44,
    borderWidth: 1.2,
    borderRadius: THEME.radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBlock: { gap: 6 },
  progressTrack: {
    height: 3,
    backgroundColor: THEME.colors.borderStrong,
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 99 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  timeText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    color: THEME.colors.textDim,
  },
  externalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  externalLinkText: { fontFamily: THEME.fonts.mono, fontSize: 11 },
  entryText: {
    fontFamily: THEME.fonts.serif,
    fontSize: 16,
    lineHeight: 25,
  },
  moodHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  moodTag: {
    borderWidth: 1,
    borderRadius: THEME.radius.xs,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: THEME.colors.surfacePanel,
  },
  moodTagText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  modeMiniLabel: {
    fontFamily: THEME.fonts.serif,
    fontSize: 15,
    color: THEME.colors.textMuted,
  },
  curatorSummary: {
    color: THEME.colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  driversCol: { gap: 10, paddingTop: 2 },
  driverRow: {
    backgroundColor: THEME.colors.surfacePanel,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.sm,
    padding: 11,
    gap: 4,
  },
  driverIndex: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: THEME.colors.warmGold,
  },
  driverText: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  metaDivider: {
    height: 1,
    backgroundColor: THEME.colors.border,
    marginVertical: 2,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  specKey: { fontSize: 12, color: THEME.colors.textDim },
  specVal: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    color: THEME.colors.text,
  },
  paletteRow: { gap: 8, paddingTop: 2 },
  paletteChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paletteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  chipHex: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
});