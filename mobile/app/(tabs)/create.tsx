import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import {
  ApiError,
  createDay,
  getErrorMessage,
  searchTracks,
} from '../../services/api';
import { TrackInfo } from '../../types/memory';
import { THEME } from '../../constants/theme';

const BUILD_STAGES = [
  'Считываем интонацию и детали текста…',
  'Извлекаем свет и палитру фотографии…',
  'Синхронизируем ритм композиции с треком…',
  'Собираем страницу дня в архив…',
];

function describeEnergy(energy: number): string {
  if (energy >= 0.72) return 'Высокий ритм';
  if (energy >= 0.45) return 'Живой темп';
  return 'Спокойный ритм';
}

export default function CreateDayScreen() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState<string | null>(null);
  const [songQuery, setSongQuery] = useState('');
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<TrackInfo | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Превью-плеер прямо на экране выбора песни
  const previewPlayer = useAudioPlayer(null);
  const previewStatus = useAudioPlayerStatus(previewPlayer);
  const [previewingId, setPreviewingId] = useState<number | null>(null);

  const trimmedLen = text.trim().length;
  const step1Done = trimmedLen >= 10;
  const step2Done = Boolean(photoUri);
  const step3Done = Boolean(selectedTrack);
  const readyCount = [step1Done, step2Done, step3Done].filter(Boolean).length;

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  // Смена подписей во время сборки воспоминания
  useEffect(() => {
    if (!loading) {
      setStageIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % BUILD_STAGES.length);
    }, 1100);
    return () => clearInterval(timer);
  }, [loading]);

  // Поиск треков с дебаунсом
  useEffect(() => {
    let active = true;
    const query = songQuery.trim();

    if (query.length < 2) {
      return () => {
        active = false;
      };
    }

    const timeout = setTimeout(() => {
      setTrackLoading(true);
      void searchTracks(query)
        .then((results) => {
          if (active) setTracks(results);
        })
        .catch((requestError: unknown) => {
          if (active) {
            setTrackError(getErrorMessage(requestError));
            setNeedsAuth(requestError instanceof ApiError && requestError.status === 401);
          }
        })
        .finally(() => {
          if (active) setTrackLoading(false);
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [songQuery]);

  const stopPreview = () => {
    try {
      previewPlayer.pause();
    } catch {
      // ignore if player not loaded
    }
    setPreviewingId(null);
  };

  const toggleTrackPreview = (track: TrackInfo) => {
    if (!track.previewUrl) return;

    if (previewingId === track.id && previewStatus.playing) {
      previewPlayer.pause();
      return;
    }

    if (previewingId !== track.id) {
      setPreviewingId(track.id);
      previewPlayer.replace({ uri: track.previewUrl });
    }
    previewPlayer.play();
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Нужен доступ', 'Разреши доступ к галерее, чтобы выбрать фото дня.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.75,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
        setPhotoBase64(result.assets[0].base64 ?? null);
        setPhotoMimeType(result.assets[0].mimeType ?? null);
        setError(null);
      }
    } catch (pickerError) {
      setError(getErrorMessage(pickerError));
    }
  };

  const handleSave = async () => {
    if (loading) return;
    if (!step1Done || !photoUri || !selectedTrack) {
      setError('Заполните все 3 шага: текст (от 10 символов), фотографию и трек из поиска.');
      return;
    }

    stopPreview();

    try {
      setError(null);
      setLoading(true);
      const created = await createDay({
        text: text.trim(),
        photoUri,
        photoBase64: photoBase64 ?? undefined,
        photoMimeType: photoMimeType ?? undefined,
        track: selectedTrack,
      });

      setText('');
      setPhotoUri(null);
      setPhotoBase64(null);
      setPhotoMimeType(null);
      setSongQuery('');
      setTracks([]);
      setSelectedTrack(null);

      router.push(`/memory/${created.id}`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setNeedsAuth(requestError instanceof ApiError && requestError.status === 401);
    } finally {
      setLoading(false);
    }
  };

  const canRenderPhoto = Boolean(
    photoUri && (Platform.OS === 'web' || !/^blob:/i.test(photoUri))
  );

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Шапка + живой индикатор готовности */}
        <View style={styles.intro}>
          <Text style={styles.introTitle}>Зафиксируй ощущение дня</Text>
          <Text style={styles.introSub}>
            Слова, свет фотографии и ритм песни сложатся в живую страницу твоего дневника.
          </Text>
          <View style={styles.progressRow}>
            {[step1Done, step2Done, step3Done].map((done, idx) => (
              <View
                key={idx}
                style={[styles.progressBar, done && styles.progressBarActive]}
              />
            ))}
            <Text style={styles.progressText}>{readyCount}/3</Text>
          </View>
        </View>

        {/* ШАГ 01 */}
        <View style={[styles.stepCard, step1Done && styles.stepCardReady]}>
          <View style={styles.stepHeader}>
            <View style={styles.stepTagRow}>
              <Text style={styles.stepTag}>01 · Слова</Text>
              {step1Done && (
                <Ionicons name="checkmark-circle" size={14} color={THEME.colors.accent} />
              )}
            </View>
            <Text style={[styles.stepHint, step1Done && styles.stepHintReady]}>
              {step1Done
                ? `${trimmedLen} симв.`
                : `ещё ${Math.max(0, 10 - trimmedLen)} симв.`}
            </Text>
          </View>
          <TextInput
            style={styles.textArea}
            placeholder="Опиши детали дня: погоду, свет, запахи, кто был рядом и что чувствовалось внутри…"
            placeholderTextColor={THEME.colors.textDim}
            multiline
            maxLength={4000}
            value={text}
            onChangeText={(v) => {
              setText(v);
              setError(null);
            }}
            textAlignVertical="top"
          />
        </View>

        {/* ШАГ 02 */}
        <View style={[styles.stepCard, step2Done && styles.stepCardReady]}>
          <View style={styles.stepHeader}>
            <View style={styles.stepTagRow}>
              <Text style={styles.stepTag}>02 · Кадр дня</Text>
              {step2Done && (
                <Ionicons name="checkmark-circle" size={14} color={THEME.colors.accent} />
              )}
            </View>
            <Text style={styles.stepHint}>Задаёт свет и палитру</Text>
          </View>
          <TouchableOpacity style={styles.photoBox} onPress={pickImage} activeOpacity={0.82}>
            {canRenderPhoto && photoUri ? (
              <>
                <Image source={{ uri: photoUri }} style={styles.previewImage} />
                <View style={styles.changePhotoBadge}>
                  <Ionicons name="refresh" size={13} color={THEME.colors.text} />
                  <Text style={styles.changePhotoText}>Заменить фото</Text>
                </View>
              </>
            ) : (
              <View style={styles.photoEmpty}>
                <View style={styles.photoIconCircle}>
                  <Ionicons name="image-outline" size={24} color={THEME.colors.accent} />
                </View>
                <Text style={styles.photoPlaceholder}>Выбрать фотографию из галереи</Text>
                <Text style={styles.photoSub}>Подойдёт любой снимок этого дня</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ШАГ 03 */}
        <View style={[styles.stepCard, step3Done && styles.stepCardReady]}>
          <View style={styles.stepHeader}>
            <View style={styles.stepTagRow}>
              <Text style={styles.stepTag}>03 · Саундтрек</Text>
              {step3Done && (
                <Ionicons name="checkmark-circle" size={14} color={THEME.colors.accent} />
              )}
            </View>
            <Text style={styles.stepHint}>Влияет на ритм и форму</Text>
          </View>

          <View style={styles.songInputWrap}>
            <Ionicons name="musical-notes-outline" size={18} color={THEME.colors.accent} />
            <TextInput
              style={styles.songInput}
              placeholder="Исполнитель или название песни"
              placeholderTextColor={THEME.colors.textDim}
              value={songQuery}
              onChangeText={(value) => {
                stopPreview();
                setSongQuery(value);
                setSelectedTrack(null);
                setTracks([]);
                setTrackError(null);
                setNeedsAuth(false);
                setTrackLoading(value.trim().length >= 2);
                setError(null);
              }}
            />
            {songQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  stopPreview();
                  setSongQuery('');
                  setTracks([]);
                  setSelectedTrack(null);
                  setTrackError(null);
                }}
              >
                <Ionicons name="close-circle" size={18} color={THEME.colors.textDim} />
              </TouchableOpacity>
            )}
          </View>

          {selectedTrack ? (
            <View style={styles.selectedTrack}>
              {selectedTrack.artworkUrl ? (
                <Image
                  source={{ uri: selectedTrack.artworkUrl }}
                  style={styles.artwork}
                />
              ) : (
                <View style={styles.artworkFallback}>
                  <Ionicons name="disc-outline" size={20} color={THEME.colors.accent} />
                </View>
              )}

              <View style={styles.selectedTrackInfo}>
                <Text style={styles.selectedTrackTitle} numberOfLines={1}>
                  {selectedTrack.title}
                </Text>
                <Text style={styles.stepHint} numberOfLines={1}>
                  {selectedTrack.artist} · {selectedTrack.genre}
                </Text>
                <Text style={styles.energyTag}>
                  {describeEnergy(selectedTrack.energy)} ({Math.round(selectedTrack.energy * 100)}%)
                </Text>
              </View>

              <View style={styles.selectedActions}>
                {selectedTrack.previewUrl ? (
                  <TouchableOpacity
                    onPress={() => toggleTrackPreview(selectedTrack)}
                    style={styles.previewBtnActive}
                  >
                    <Ionicons
                      name={
                        previewingId === selectedTrack.id && previewStatus.playing
                          ? 'pause'
                          : 'play'
                      }
                      size={15}
                      color={THEME.colors.accentText}
                    />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() => {
                    stopPreview();
                    setSelectedTrack(null);
                  }}
                >
                  <Text style={styles.changeTrack}>Сменить</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : trackLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={THEME.colors.accent} />
              <Text style={styles.stepHint}>Ищем официальные фрагменты…</Text>
            </View>
          ) : trackError ? (
            <View style={styles.trackError}>
              <Text style={styles.errorText}>{trackError}</Text>
              {needsAuth ? (
                <TouchableOpacity onPress={() => router.push('/auth/login')}>
                  <Text style={styles.changeTrack}>Войти в аккаунт →</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : tracks.length > 0 ? (
            <View style={styles.trackResults}>
              {tracks.map((track, idx) => {
                const isPlayingThis =
                  previewingId === track.id && previewStatus.playing;
                return (
                  <View
                    key={track.id}
                    style={[
                      styles.trackResult,
                      idx === tracks.length - 1 && styles.trackResultLast,
                    ]}
                  >
                    {/* Кнопка прослушивания превью */}
                    <TouchableOpacity
                      onPress={() => toggleTrackPreview(track)}
                      style={styles.artworkWrap}
                      activeOpacity={0.8}
                    >
                      {track.artworkUrl ? (
                        <Image source={{ uri: track.artworkUrl }} style={styles.artwork} />
                      ) : (
                        <View style={styles.artworkFallback}>
                          <Ionicons name="musical-note" size={16} color={THEME.colors.accent} />
                        </View>
                      )}
                      {track.previewUrl ? (
                        <View style={styles.artworkPlayOverlay}>
                          <Ionicons
                            name={isPlayingThis ? 'pause' : 'play'}
                            size={14}
                            color="#FFFFFF"
                          />
                        </View>
                      ) : null}
                    </TouchableOpacity>

                    {/* Выбор трека */}
                    <TouchableOpacity
                      style={styles.trackResultMain}
                      onPress={() => {
                        setSelectedTrack(track);
                        setError(null);
                      }}
                    >
                      <View style={styles.trackResultText}>
                        <Text style={styles.trackResultTitle} numberOfLines={1}>
                          {track.title}
                        </Text>
                        <Text style={styles.stepHint} numberOfLines={1}>
                          {track.artist} · {track.genre} · {describeEnergy(track.energy)}
                        </Text>
                      </View>
                      <Ionicons
                        name="add-circle-outline"
                        size={22}
                        color={THEME.colors.accent}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ) : songQuery.trim().length >= 2 ? (
            <Text style={styles.stepHint}>Подходящих треков с preview не найдено.</Text>
          ) : (
            <Text style={styles.stepHint}>
              Начни вводить исполнителя или название — фрагмент можно послушать прямо в списке.
            </Text>
          )}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            {needsAuth ? (
              <TouchableOpacity onPress={() => router.push('/auth/login')}>
                <Text style={styles.changeTrack}>Войти в аккаунт →</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.submitBtn,
            (loading || readyCount < 3) && styles.submitBtnDim,
          ]}
          onPress={handleSave}
          disabled={loading || readyCount < 3}
          activeOpacity={0.85}
        >
          <Text style={styles.submitText}>СОБРАТЬ ВОСПОМИНАНИЕ →</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Атмосферный экран сборки воспоминания */}
      <Modal transparent visible={loading} animationType="fade">
        <View style={styles.overlayRoot}>
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color={THEME.colors.accent} />
            <Text style={styles.overlayTitle}>Создаём страницу дня</Text>
            <Text style={styles.overlayStage}>{BUILD_STAGES[stageIndex]}</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  content: {
    padding: THEME.spacing.md,
    gap: 16,
    paddingBottom: 44,
  },
  intro: { gap: 6, marginBottom: 2 },
  introTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 26,
    color: THEME.colors.text,
  },
  introSub: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  progressBar: {
    flex: 1,
    height: 3,
    borderRadius: 99,
    backgroundColor: THEME.colors.borderStrong,
  },
  progressBarActive: {
    backgroundColor: THEME.colors.accent,
  },
  progressText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.accent,
  },
  stepCard: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: 14,
    gap: 10,
  },
  stepCardReady: {
    borderColor: 'rgba(216, 255, 75, 0.28)',
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepTag: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.accent,
    letterSpacing: 0.8,
  },
  stepHint: {
    fontSize: 11,
    color: THEME.colors.textDim,
  },
  stepHintReady: {
    color: THEME.colors.textMuted,
  },
  textArea: {
    backgroundColor: THEME.colors.surfaceElevated,
    color: THEME.colors.text,
    borderRadius: THEME.radius.sm,
    padding: 14,
    minHeight: 112,
    fontSize: 15,
    lineHeight: 22,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  photoBox: {
    height: 215,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: THEME.colors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photoEmpty: { alignItems: 'center', gap: 6, paddingHorizontal: 20 },
  photoIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 99,
    backgroundColor: THEME.colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  photoPlaceholder: {
    color: THEME.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  photoSub: { color: THEME.colors.textMuted, fontSize: 12 },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  changePhotoBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(7,7,10,0.78)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.pill,
  },
  changePhotoText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    color: THEME.colors.text,
  },
  songInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.sm,
    paddingHorizontal: 14,
  },
  songInput: {
    flex: 1,
    color: THEME.colors.text,
    paddingVertical: 13,
    fontSize: 14,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  trackResults: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.sm,
    overflow: 'hidden',
    backgroundColor: THEME.colors.surfaceElevated,
  },
  trackResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  trackResultLast: {
    borderBottomWidth: 0,
  },
  artworkWrap: {
    width: 42,
    height: 42,
    borderRadius: THEME.radius.xs,
    overflow: 'hidden',
    position: 'relative',
  },
  artwork: {
    width: 42,
    height: 42,
    borderRadius: THEME.radius.xs,
  },
  artworkFallback: {
    width: 42,
    height: 42,
    borderRadius: THEME.radius.xs,
    backgroundColor: THEME.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artworkPlayOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(7, 7, 10, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackResultMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  trackResultText: { flex: 1, gap: 3 },
  trackResultTitle: { color: THEME.colors.text, fontSize: 13, fontWeight: '600' },
  selectedTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.accent,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.accentSoft,
  },
  selectedTrackInfo: { flex: 1, gap: 2 },
  selectedTrackTitle: { color: THEME.colors.text, fontSize: 14, fontWeight: '700' },
  energyTag: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    color: THEME.colors.accent,
    marginTop: 2,
  },
  selectedActions: {
    alignItems: 'center',
    gap: 6,
  },
  previewBtnActive: {
    width: 30,
    height: 30,
    borderRadius: 99,
    backgroundColor: THEME.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeTrack: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.accent,
  },
  trackError: { gap: 8 },
  errorBox: {
    backgroundColor: 'rgba(255, 84, 84, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 84, 84, 0.35)',
    borderRadius: THEME.radius.sm,
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: THEME.colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  submitBtn: {
    backgroundColor: THEME.colors.accent,
    paddingVertical: 17,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDim: { opacity: 0.45 },
  submitText: {
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.accentText,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1.1,
  },
  overlayRoot: {
    flex: 1,
    backgroundColor: 'rgba(7, 7, 10, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  overlayCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.radius.md,
    padding: 28,
    alignItems: 'center',
    gap: 14,
  },
  overlayTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 21,
    color: THEME.colors.text,
  },
  overlayStage: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.accent,
    textAlign: 'center',
    lineHeight: 17,
  },
});