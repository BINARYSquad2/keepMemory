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
  Alert,
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
import * as Speech from 'expo-speech';
import { ApiError, deleteDay, getDay, getErrorMessage } from '../../services/api';
import {
  formatMemoryDate,
  getMemoryPhotos,
  MemoryDay,
  MoodCategory,
} from '../../types/memory';
import { ART_STYLE_META, TYPOGRAPHY_LABELS } from '../../constants/artStyles';
import { analyzeDayAtmosphere } from '../../services/atmosphereInterpreter';
import { MemoryCanvas } from '../../components/MemoryCanvas';
import { THEME } from '../../constants/theme';

interface NarrationVoicePreset {
  rate: number;
  pitch: number;
  label: string;
}

function getNarrationVoicePreset(
  mood: MoodCategory,
  energy: number
): NarrationVoicePreset {
  switch (mood) {
    case 'sad':
      return { rate: 0.85, pitch: 0.92, label: 'Тихий, замедленный голос (0.85x)' };
    case 'calm':
      return { rate: 0.9, pitch: 0.96, label: 'Спокойный созерцательный тон (0.90x)' };
    case 'warm':
      return { rate: 0.95, pitch: 0.99, label: 'Тёплая камерная подача (0.95x)' };
    case 'happy':
      return { rate: 1.04, pitch: 1.05, label: 'Живой и светлый темп (1.04x)' };
    case 'energetic':
      return {
        rate: energy >= 0.78 ? 1.12 : 1.07,
        pitch: 1.04,
        label: `Динамичный собранный темп (${energy >= 0.78 ? '1.12' : '1.07'}x)`,
      };
  }
}

function formatSec(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = String(total % 60).padStart(2, '0');

  return `${mins}:${secs}`;
}

function formatSentenceCase(value: string): string {
  const clean = value.trim().toLowerCase();
  if (!clean) return '';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function formatFullHeaderDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return formatMemoryDate(value);

  const formatted = date.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
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
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [showSystemDetails, setShowSystemDetails] = useState(true);

  useEffect(() => {
    let active = true;
    setActivePhotoIndex(0);
    setSpeaking(false);
    setSpeechError(null);

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
  const voicePreset = useMemo(
    () =>
      memory && atmosphere
        ? getNarrationVoicePreset(atmosphere.moodCategory, memory.track.energy ?? 0.5)
        : null,
    [memory, atmosphere]
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

  useEffect(() => {
    return () => {
      void Speech.stop().catch((err: unknown) => {
        console.error('stop memory narration:', err);
      });
    };
  }, [id]);

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
      if (speaking) {
        void Speech.stop().catch((err: unknown) =>
          setSpeechError(getErrorMessage(err))
        );
        setSpeaking(false);
      }
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
        'Сохранение PNG-открытки доступно в мобильном приложении (iOS и Android).'
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

  const performDelete = async () => {
    if (!id || deleting) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      player.pause();
      if (speaking) {
        await Speech.stop().catch(() => {});
        setSpeaking(false);
      }
      const result = await deleteDay(id);
      if (result.warning) {
        if (Platform.OS === 'web') {
          globalThis.alert?.(`Запись удалена. ${result.warning}`);
          router.replace('/(tabs)');
        } else {
          Alert.alert('Запись удалена', result.warning, [
            { text: 'Продолжить', onPress: () => router.replace('/(tabs)') },
          ]);
        }
        return;
      }
      router.replace('/(tabs)');
    } catch (requestError) {
      setDeleteError(getErrorMessage(requestError));
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Удалить это воспоминание и его загруженные фотографии?')) {
        void performDelete();
      }
      return;
    }
    Alert.alert(
      'Удалить воспоминание?',
      'Запись и загруженные фотографии будут удалены без возможности восстановления.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: () => void performDelete() },
      ]
    );
  };

  const toggleNarration = () => {
    if (speaking) {
      void Speech.stop()
        .then(() => setSpeaking(false))
        .catch((err: unknown) => setSpeechError(getErrorMessage(err)));
      return;
    }

    if (!memory || !atmosphere || !voicePreset) return;
    if (status.playing) player.pause();
    setSpeechError(null);
    try {
      Speech.speak(
        `${memory.folderTitle}. ${memory.text}`,
        {
          language: 'ru-RU',
          rate: voicePreset.rate,
          pitch: voicePreset.pitch,
          onStart: () => setSpeaking(true),
          onDone: () => setSpeaking(false),
          onStopped: () => setSpeaking(false),
          onError: (err) => {
            setSpeaking(false);
            setSpeechError(getErrorMessage(err));
          },
        }
      );
    } catch (err) {
      setSpeaking(false);
      setSpeechError(getErrorMessage(err));
    }
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={THEME.colors.accent} />
          <Text style={styles.loadingText}>Открываем запись дня…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!memory || !atmosphere || !voicePreset) {
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

          <TouchableOpacity onPress={handleGoBack}>
            <Text style={styles.backLink}>Вернуться в дневник</Text>
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
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color={THEME.colors.text} />
          <Text style={styles.backText}>Дневник</Text>
        </TouchableOpacity>

        <Text style={styles.topDate}>{formatFullHeaderDate(memory.date)}</Text>
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
              <Text style={styles.cardTitleSmall}>Альбом дня</Text>
              <Text style={[styles.statusLabel, { color: accentCol }]}>
                Кадр {activePhotoIndex + 1} из {photos.length}
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
                        {idx + 1}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Кнопка сохранения PNG */}
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
              size={17}
              color={THEME.colors.accent}
            />
          )}

          <Text style={styles.exportBtnText}>
            {exporting ? 'Сохраняем открытку…' : 'Сохранить открытку (PNG)'}
          </Text>
        </TouchableOpacity>

        {exportError ? (
          <Text style={styles.audioError}>{exportError}</Text>
        ) : null}
        {deleteError ? <Text style={styles.audioError}>{deleteError}</Text> : null}

        <TouchableOpacity
          onPress={confirmDelete}
          disabled={deleting}
          activeOpacity={0.82}
          style={[styles.deleteBtn, deleting && styles.exportBtnDisabled]}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={THEME.colors.danger} />
          ) : (
            <Ionicons name="trash-outline" size={17} color={THEME.colors.danger} />
          )}
          <Text style={styles.deleteBtnText}>
            {deleting ? 'Удаляем запись…' : 'Удалить воспоминание'}
          </Text>
        </TouchableOpacity>

        {/* Карточка песни дня */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitleSmall}>Саундтрек дня</Text>

            <Text style={[styles.statusLabel, { color: accentCol }]}>
              {isPlaying ? 'Звучит' : 'Пауза'} · темп {memory.style.motionSpeed.toFixed(1)}x
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

        {/* Текст записи и озвучка под настроение */}
        <View style={styles.card}>
          <Text style={styles.cardTitleSmall}>Запись дня</Text>
          <Text style={[styles.entryText, { color: lightCol }]}>
            {memory.text}
          </Text>

          <View style={styles.metaDivider} />

          <View style={styles.narrationRow}>
            <View style={styles.narrationMeta}>
              <Text style={styles.narrationTitle}>Озвучивание дня</Text>
              <Text style={styles.narrationSub}>{voicePreset.label}</Text>
            </View>

            <TouchableOpacity
              onPress={toggleNarration}
              activeOpacity={0.82}
              style={[
                styles.narrationBtn,
                { borderColor: accentCol },
                speaking && { backgroundColor: accentCol },
              ]}
            >
              <Ionicons
                name={speaking ? 'stop' : 'volume-high-outline'}
                size={16}
                color={speaking ? '#07070A' : accentCol}
              />
              <Text
                style={[
                  styles.narrationBtnText,
                  { color: speaking ? '#07070A' : THEME.colors.text },
                ]}
              >
                {speaking ? 'Стоп' : 'Слушать'}
              </Text>
            </TouchableOpacity>
          </View>

          {speechError ? <Text style={styles.audioError}>{speechError}</Text> : null}
        </View>

        {/* Разбор атмосферы конкретного дня */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardHeaderRow}
            onPress={() => setShowSystemDetails((prev) => !prev)}
            activeOpacity={0.75}
          >
            <Text style={styles.cardTitleSmall}>Как собрано это воспоминание</Text>
            <Ionicons
              name={showSystemDetails ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={THEME.colors.textMuted}
            />
          </TouchableOpacity>

          <View style={styles.moodHeaderRow}>
            <View style={[styles.moodTag, { borderColor: accentCol }]}>
              <Text style={[styles.moodTagText, { color: accentCol }]}>
                {formatSentenceCase(atmosphere.moodBadge)}
              </Text>
            </View>
            <Text style={styles.modeMiniLabel}>{modeMeta.shortTitle}</Text>
          </View>

          <Text style={styles.curatorSummary}>{atmosphere.curatorSummary}</Text>

          {showSystemDetails ? (
            <View style={styles.driversCol}>
              <View style={styles.driverRow}>
                <Text style={styles.driverLabel}>Текст</Text>
                <Text style={styles.driverText}>{atmosphere.drivers.text}</Text>
              </View>

              <View style={styles.driverRow}>
                <Text style={styles.driverLabel}>Палитра и свет</Text>
                <Text style={styles.driverText}>
                  {atmosphere.drivers.palette}
                </Text>
              </View>

              <View style={styles.driverRow}>
                <Text style={styles.driverLabel}>Музыка и ритм</Text>
                <Text style={styles.driverText}>
                  {atmosphere.drivers.music}
                </Text>
              </View>

              <View style={styles.driverRow}>
                <Text style={styles.driverLabel}>Альбом и художественный приём</Text>
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

              <View style={styles.specRow}>
                <Text style={styles.specKey}>Голос озвучки</Text>
                <Text style={styles.specVal}>{voicePreset.label}</Text>
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
    color: THEME.colors.accent,
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 15,
    fontWeight: '500',
    color: THEME.colors.text,
  },
  topDate: {
    fontSize: 13,
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
    padding: 15,
    gap: 12,
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
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  thumbNumText: {
    fontSize: 10,
    color: THEME.colors.text,
    fontWeight: '700',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    backgroundColor: THEME.colors.surface,
  },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 84, 84, 0.35)',
    backgroundColor: THEME.colors.surface,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.danger,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: 16,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitleSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 11,
    color: THEME.colors.textDim,
  },
  externalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  externalLinkText: {
    fontSize: 13,
    fontWeight: '500',
  },
  entryText: {
    fontFamily: THEME.fonts.serif,
    fontSize: 16,
    lineHeight: 25,
  },
  narrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  narrationMeta: {
    flex: 1,
    gap: 2,
  },
  narrationTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  narrationSub: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  narrationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
  },
  narrationBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  moodHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  moodTag: {
    borderWidth: 1,
    borderRadius: THEME.radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 4,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  moodTagText: {
    fontSize: 12,
    fontWeight: '600',
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
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.sm,
    padding: 12,
    gap: 4,
  },
  driverLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.warmGold,
  },
  driverText: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
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
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
});