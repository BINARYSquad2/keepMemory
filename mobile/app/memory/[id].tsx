import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from 'expo-audio';
import { ApiError, getDay, getErrorMessage } from '../../services/api';
import { MemoryDay } from '../../types/memory';
import { MemoryCanvas } from '../../components/MemoryCanvas';
import { THEME } from '../../constants/theme';
import { TechCard } from '../../components/ui/TechPrimitives';

export default function MemoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loadedDay, setLoadedDay] = useState<{
    id: string;
    memory: MemoryDay | null;
    error: string | null;
    needsAuth: boolean;
  } | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!id) {
      return;
    }

    void getDay(id)
      .then((day) => {
        if (active) {
          setLoadedDay({ id, memory: day, error: null, needsAuth: false });
        }
      })
      .catch((requestError: unknown) => {
        if (active) setLoadedDay({
          id,
          memory: null,
          error: getErrorMessage(requestError),
          needsAuth: requestError instanceof ApiError && requestError.status === 401,
        });
      });

    return () => {
      active = false;
    };
  }, [id]);

  const resultForId = loadedDay?.id === id ? loadedDay : null;
  const memory = resultForId?.memory ?? null;
  const loading = Boolean(id) && resultForId === null;
  const error = resultForId?.error ?? (id ? null : 'Не указан идентификатор записи.');
  const needsAuth = resultForId?.needsAuth ?? false;
  const previewUrl = memory?.track.previewUrl || '';
  const player = useAudioPlayer(previewUrl ? { uri: previewUrl } : null);
  const status = useAudioPlayerStatus(player);
  const isPlaying = Boolean(previewUrl) && status.playing;

  useEffect(() => {
    let active = true;
    void setAudioModeAsync({ playsInSilentMode: true }).catch((audioModeError: unknown) => {
      if (active) setAudioError(getErrorMessage(audioModeError));
    });
    return () => {
      active = false;
    };
  }, []);

  const togglePlay = () => {
    if (!memory) return;

    if (!previewUrl) {
      setAudioError('У этого трека нет доступного фрагмента для воспроизведения.');
      return;
    }

    setAudioError(null);
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={THEME.colors.accent} />
          <Text style={styles.errorText}>Загружаю запись из Go API…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!memory) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || 'Запись не найдена.'}</Text>
          {needsAuth ? (
            <TouchableOpacity onPress={() => router.push('/auth/login')}>
              <Text style={styles.backLink}>Войти в аккаунт</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>← Вернуться в архив</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Верхняя навигация */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={18} color={THEME.colors.text} />
          <Text style={styles.backText}>АРХИВ</Text>
        </TouchableOpacity>
        <Text style={styles.topId}>{memory.id.toUpperCase()}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Визуальное воспоминание (Skia + Reanimated) */}
        <MemoryCanvas memory={memory} isPlaying={isPlaying} />

        {/* Блок плеера трека */}
        <TechCard headerTag="AUDIO_SYNC // TRACK PREVIEW">
          <View style={styles.playerRow}>
            <TouchableOpacity
              onPress={togglePlay}
              style={[
                styles.playBtn,
                { borderColor: memory.style.palette[1] },
                isPlaying && { backgroundColor: memory.style.palette[1] },
              ]}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={20}
                color={isPlaying ? '#060608' : memory.style.palette[1]}
              />
            </TouchableOpacity>

            <View style={styles.trackMeta}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {memory.track.title}
              </Text>
              <Text style={styles.trackSub} numberOfLines={1}>
                {memory.track.artist} · {memory.track.genre.toUpperCase()}
              </Text>
            </View>

            <Text style={styles.speedBadge}>
              {memory.style.motionSpeed.toFixed(1)}x
            </Text>
          </View>
          {audioError ? <Text style={styles.audioError}>{audioError}</Text> : null}
        </TechCard>

        {/* Текст записи */}
        <TechCard headerTag="JOURNAL // ENTRY TEXT">
          <Text style={styles.entryText}>{memory.text}</Text>
        </TechCard>

        {/* Параметры рецепта */}
        <TechCard headerTag="VISUAL_SYSTEM // STYLE RECIPE">
          <View style={styles.specGrid}>
            <View style={styles.specRow}>
              <Text style={styles.specKey}>ART_STYLE</Text>
              <Text style={styles.specVal}>{memory.style.artStyle}</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specKey}>GRAIN_INTENSITY</Text>
              <Text style={styles.specVal}>{Math.round(memory.style.grainIntensity * 100)}%</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specKey}>MOTION_SPEED</Text>
              <Text style={styles.specVal}>{memory.style.motionSpeed} (от ритма трека)</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specKey}>TYPOGRAPHY</Text>
              <Text style={styles.specVal}>{memory.style.typographyVariant}</Text>
            </View>
          </View>
        </TechCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { color: THEME.colors.text, fontSize: 14, textAlign: 'center' },
  audioError: {
    color: THEME.colors.danger,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  backLink: { fontFamily: THEME.fonts.mono, color: THEME.colors.accent },
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
    fontFamily: THEME.fonts.mono,
    fontSize: 12,
    letterSpacing: 1.2,
    color: THEME.colors.text,
  },
  topId: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.textDim,
  },
  scroll: {
    padding: THEME.spacing.md,
    gap: 16,
    paddingBottom: 40,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: THEME.radius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackMeta: { flex: 1, gap: 2 },
  trackTitle: {
    color: THEME.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  trackSub: {
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.textMuted,
    fontSize: 11,
  },
  speedBadge: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.accent,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  entryText: {
    color: THEME.colors.text,
    fontSize: 15,
    lineHeight: 23,
  },
  specGrid: { gap: 8 },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    paddingBottom: 6,
  },
  specKey: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.textDim,
  },
  specVal: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.text,
  },
});