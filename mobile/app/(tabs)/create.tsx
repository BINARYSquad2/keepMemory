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
import { Href, useRouter } from 'expo-router';
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
import { DraftPhoto, TrackInfo } from '../../types/memory';
import { THEME } from '../../constants/theme';

const MAX_PHOTOS = 6;

const BUILD_STAGES = [
  'Считываем интонацию и детали текста…',
  'Извлекаем свет и палитру альбома…',
  'Синхронизируем ритм кадров с треком…',
  'Собираем папку дня в архив…',
];

function describeEnergy(energy: number): string {
  if (energy >= 0.72) return 'Высокий ритм';
  if (energy >= 0.45) return 'Живой темп';
  return 'Спокойный ритм';
}

export default function CreateDayScreen() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
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
  const step2Done = photos.length > 0;
  const step3Done = Boolean(selectedTrack);
  const readyCount = [step1Done, step2Done, step3Done].filter(Boolean).length;

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading) {
      setStageIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % BUILD_STAGES.length);
    }, 1050);
    return () => clearInterval(timer);
  }, [loading]);

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

  const pickImages = async () => {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      Alert.alert('Альбом заполнен', `В один день можно добавить до ${MAX_PHOTOS} фотографий.`);
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Нужен доступ', 'Разреши доступ к галерее, чтобы собрать альбом дня.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        allowsEditing: false,
        quality: 0.72,
        base64: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const picked: DraftPhoto[] = result.assets.map((asset) => ({
          uri: asset.uri,
          base64: asset.base64 ?? undefined,
          mimeType: asset.mimeType ?? undefined,
        }));

        setPhotos((prev) => {
          const seen = new Set(prev.map((p) => p.uri));
          const merged = [...prev];
          for (const item of picked) {
            if (!seen.has(item.uri) && merged.length < MAX_PHOTOS) {
              merged.push(item);
              seen.add(item.uri);
            }
          }
          return merged;
        });
        setError(null);
      }
    } catch (pickerError) {
      setError(getErrorMessage(pickerError));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const makeCover = (index: number) => {
    if (index === 0) return;
    setPhotos((prev) => {
      const next = [...prev];
      const [chosen] = next.splice(index, 1);
      return [chosen, ...next];
    });
  };

  const handleSave = async () => {
    if (loading) return;
    const cover = photos[0];
    if (!step1Done || !cover || !selectedTrack) {
      setError('Заполните все 3 шага: текст (от 10 символов), минимум 1 фото и трек из поиска.');
      return;
    }

    stopPreview();

    try {
      setError(null);
      setLoading(true);
      const created = await createDay({
        text: text.trim(),
        photoUri: cover.uri,
        photoBase64: cover.base64,
        photoMimeType: cover.mimeType,
        photos,
        track: selectedTrack,
      });

      setText('');
      setPhotos([]);
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

  const coverPhoto = photos[0] ?? null;
  const canRenderUri = (uri?: string) =>
    Boolean(uri && (Platform.OS === 'web' || !/^blob:/i.test(uri)));

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Шапка Genesis.exe × ArtTech */}
        <View style={styles.introCard}>
          <View style={styles.cornerTL} />
          <View style={styles.cornerBR} />
          <View style={styles.introTopRow}>
            <Text style={styles.eyebrow}>• CAPTURE.EXE // NEW_MEMORY</Text>
            <TouchableOpacity onPress={() => router.push('/guide' as Href)}>
              <Text style={styles.guideLink}>Гид →</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.introTitle}>Зафиксируй ощущение дня_</Text>
          <Text style={styles.introSub}>
            Слова, альбом фотографий и саундтрек сложатся в живую страницу твоего дневника.
          </Text>
          <View style={styles.progressRow}>
            {[
              { label: 'СЛОВА', done: step1Done },
              { label: 'АЛЬБОМ', done: step2Done },
              { label: 'ТРЕК', done: step3Done },
            ].map((item) => (
              <View key={item.label} style={styles.progressCol}>
                <View
                  style={[styles.progressBar, item.done && styles.progressBarActive]}
                />
                <Text
                  style={[
                    styles.progressStepLabel,
                    item.done && styles.progressStepLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            ))}
            <Text style={styles.progressText}>{readyCount}/3</Text>
          </View>
        </View>

        {/* ШАГ 01 // СЛОВА */}
        <View style={[styles.stepCard, step1Done && styles.stepCardReady]}>
          <View style={styles.stepHeader}>
            <View style={styles.stepTagRow}>
              <Text style={styles.stepTag}>01 // СЛОВА</Text>
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

        {/* ШАГ 02 // АЛЬБОМ КАДРОВ */}
        <View style={[styles.stepCard, step2Done && styles.stepCardReady]}>
          <View style={styles.stepHeader}>
            <View style={styles.stepTagRow}>
              <Text style={styles.stepTag}>02 // АЛЬБОМ ФОТО</Text>
              {step2Done && (
                <Ionicons name="checkmark-circle" size={14} color={THEME.colors.accent} />
              )}
            </View>
            <Text style={[styles.stepHint, step2Done && styles.stepHintReady]}>
              {photos.length}/{MAX_PHOTOS} кадров
            </Text>
          </View>

          {coverPhoto && canRenderUri(coverPhoto.uri) ? (
            <View style={styles.albumBlock}>
              {/* Главный кадр обложки */}
              <View style={styles.coverBox}>
                <Image source={{ uri: coverPhoto.uri }} style={styles.previewImage} />
                <View style={styles.coverOverlayTop}>
                  <View style={styles.coverBadge}>
                    <View style={styles.coverDot} />
                    <Text style={styles.coverBadgeText}>
                      ГЛАВНЫЙ КАДР · 1/{photos.length}
                    </Text>
                  </View>
                  {photos.length < MAX_PHOTOS ? (
                    <TouchableOpacity
                      onPress={pickImages}
                      style={styles.addMorePill}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add" size={14} color={THEME.colors.accentText} />
                      <Text style={styles.addMoreText}>Ещё фото</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {/* Плёночная полоска миниатюр альбома */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filmstrip}
              >
                {photos.map((photo, idx) => {
                  const isCover = idx === 0;
                  return (
                    <TouchableOpacity
                      key={`${photo.uri}-${idx}`}
                      onPress={() => makeCover(idx)}
                      activeOpacity={0.85}
                      style={[
                        styles.thumbWrap,
                        isCover && styles.thumbWrapCover,
                      ]}
                    >
                      {canRenderUri(photo.uri) ? (
                        <Image source={{ uri: photo.uri }} style={styles.thumbImg} />
                      ) : null}
                      <View style={styles.thumbIndex}>
                        <Text style={styles.thumbIndexText}>
                          {isCover ? '★' : `0${idx + 1}`}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removePhoto(idx)}
                        style={styles.thumbDelete}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="close" size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}

                {photos.length < MAX_PHOTOS ? (
                  <TouchableOpacity
                    onPress={pickImages}
                    style={styles.thumbAddTile}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={20} color={THEME.colors.accent} />
                    <Text style={styles.thumbAddLabel}>Добавить</Text>
                  </TouchableOpacity>
                ) : null}
              </ScrollView>

              <Text style={styles.albumTip}>
                {photos.length > 1
                  ? 'Кадры будут плавно сменяться в ритме песни. Нажми на миниатюру, чтобы сделать её обложкой.'
                  : 'Можешь добавить ещё до 5 снимков, чтобы собрать живой альбом дня.'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.photoBox} onPress={pickImages} activeOpacity={0.82}>
              <View style={styles.photoEmpty}>
                <View style={styles.photoIconCircle}>
                  <Ionicons name="images-outline" size={24} color={THEME.colors.accent} />
                </View>
                <Text style={styles.photoPlaceholder}>Выбрать 1–6 фотографий дня</Text>
                <Text style={styles.photoSub}>
                  Из них сложится палитра и живой альбом воспоминания
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ШАГ 03 // САУНДТРЕК */}
        <View style={[styles.stepCard, step3Done && styles.stepCardReady]}>
          <View style={styles.stepHeader}>
            <View style={styles.stepTagRow}>
              <Text style={styles.stepTag}>03 // САУНДТРЕК</Text>
              {step3Done && (
                <Ionicons name="checkmark-circle" size={14} color={THEME.colors.accent} />
              )}
            </View>
            <Text style={styles.stepHint}>Задаёт ритм и темп кадров</Text>
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
            <View style={styles.cornerTL} />
            <View style={styles.cornerBR} />
            <ActivityIndicator size="large" color={THEME.colors.accent} />
            <Text style={styles.overlayCode}>RENDER.EXE // SYNTHESIS</Text>
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
    paddingBottom: 48,
  },
  introCard: {
    position: 'relative',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.radius.md,
    padding: 16,
    gap: 7,
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
  introTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: THEME.colors.accent,
  },
  guideLink: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    color: THEME.colors.warmGold,
  },
  introTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 25,
    color: THEME.colors.text,
  },
  introSub: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  progressCol: { flex: 1, gap: 4 },
  progressBar: {
    height: 3,
    borderRadius: 99,
    backgroundColor: THEME.colors.borderStrong,
  },
  progressBarActive: {
    backgroundColor: THEME.colors.accent,
  },
  progressStepLabel: {
    fontFamily: THEME.fonts.mono,
    fontSize: 8,
    letterSpacing: 0.8,
    color: THEME.colors.textDim,
  },
  progressStepLabelActive: {
    color: THEME.colors.text,
  },
  progressText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.accent,
    marginTop: -4,
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
    borderColor: 'rgba(216, 255, 75, 0.3)',
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
    letterSpacing: 0.9,
  },
  stepHint: {
    fontSize: 11,
    color: THEME.colors.textDim,
  },
  stepHintReady: {
    color: THEME.colors.warmGold,
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
    height: 205,
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
  photoSub: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  albumBlock: { gap: 10 },
  coverBox: {
    height: 215,
    borderRadius: THEME.radius.sm,
    overflow: 'hidden',
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
  },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverOverlayTop: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coverBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(6, 6, 9, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.pill,
  },
  coverDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: THEME.colors.accent,
  },
  coverBadgeText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.9,
    color: THEME.colors.text,
  },
  addMorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.pill,
  },
  addMoreText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.accentText,
  },
  filmstrip: {
    gap: 8,
    paddingVertical: 2,
  },
  thumbWrap: {
    width: 66,
    height: 66,
    borderRadius: THEME.radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  thumbWrapCover: {
    borderWidth: 2,
    borderColor: THEME.colors.accent,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbIndex: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(6, 6, 9, 0.78)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  thumbIndexText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    color: THEME.colors.accent,
    fontWeight: '700',
  },
  thumbDelete: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 99,
    backgroundColor: 'rgba(6, 6, 9, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbAddTile: {
    width: 66,
    height: 66,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: THEME.colors.accent,
    backgroundColor: THEME.colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  thumbAddLabel: {
    fontFamily: THEME.fonts.mono,
    fontSize: 8,
    color: THEME.colors.accent,
  },
  albumTip: {
    fontSize: 11,
    lineHeight: 16,
    color: THEME.colors.textDim,
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
    backgroundColor: 'rgba(6, 6, 9, 0.84)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  overlayCard: {
    position: 'relative',
    width: '100%',
    maxWidth: 320,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.radius.md,
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  overlayCode: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    color: THEME.colors.warmGold,
    marginTop: 4,
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