import React, { useCallback, useEffect, useState } from 'react';
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
import { useFocusEffect, useRouter } from 'expo-router';
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
  'Читаем запись и контекст вашего профиля…',
  'Подбираем свет и палитру альбома…',
  'Связываем ритм кадров с выбранной песней…',
  'Собираем страницу дня в дневник…',
];

function describeEnergy(energy: number): string {
  if (energy >= 0.72) return 'Энергичный ритм';
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
  const [allowCloudAI, setAllowCloudAI] = useState(false);

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

  const stopPreview = useCallback(() => {
    try {
      previewPlayer.pause();
    } catch {
      // плеер ещё не инициализирован
    }
    setPreviewingId(null);
  }, [previewPlayer]);

  // Останавливаем превью песни, если пользователь переключился на другой экран
  useFocusEffect(
    useCallback(() => {
      return () => {
        stopPreview();
      };
    }, [stopPreview])
  );

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
        Alert.alert('Нужен доступ', 'Разрешите доступ к галерее, чтобы выбрать фото дня.');
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
      setError('Заполните все три блока: текст (от 10 символов), минимум одно фото и песню.');
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
        allowCloudAI,
      });

      setText('');
      setPhotos([]);
      setSongQuery('');
      setTracks([]);
      setSelectedTrack(null);
      setAllowCloudAI(false);

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
        <View style={styles.introBlock}>
          <Text style={styles.introTitle}>Как прошёл этот день?</Text>
          <Text style={styles.introSub}>
            Слова, фотографии и музыка объединятся в живое воспоминание с учётом вашего стиля и настроения.
          </Text>
          <View style={styles.progressRow}>
            {[
              { label: 'Запись', done: step1Done },
              { label: 'Фото', done: step2Done },
              { label: 'Песня', done: step3Done },
            ].map((item) => (
              <View key={item.label} style={styles.progressCol}>
                <View style={[styles.progressBar, item.done && styles.progressBarActive]} />
                <Text style={[styles.progressLabel, item.done && styles.progressLabelActive]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Текст дня */}
        <View style={[styles.sectionCard, step1Done && styles.sectionCardReady]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Запись о дне</Text>
              {step1Done && (
                <Ionicons name="checkmark-circle" size={16} color={THEME.colors.accent} />
              )}
            </View>
            <Text style={[styles.sectionHint, step1Done && styles.sectionHintReady]}>
              {step1Done
                ? `${trimmedLen} симв.`
                : `ещё ${Math.max(0, 10 - trimmedLen)} симв.`}
            </Text>
          </View>
          <TextInput
            style={styles.textArea}
            placeholder="Погода, свет, запахи, люди рядом и мелкие детали, которые хочется запомнить…"
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

        {/* Альбом фотографий */}
        <View style={[styles.sectionCard, step2Done && styles.sectionCardReady]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Фотографии</Text>
              {step2Done && (
                <Ionicons name="checkmark-circle" size={16} color={THEME.colors.accent} />
              )}
            </View>
            <Text style={[styles.sectionHint, step2Done && styles.sectionHintReady]}>
              {photos.length} из {MAX_PHOTOS}
            </Text>
          </View>

          {coverPhoto && canRenderUri(coverPhoto.uri) ? (
            <View style={styles.albumBlock}>
              <View style={styles.coverBox}>
                <Image source={{ uri: coverPhoto.uri }} style={styles.previewImage} />
                <View style={styles.coverOverlayTop}>
                  <View style={styles.coverBadge}>
                    <Text style={styles.coverBadgeText}>Обложка · 1/{photos.length}</Text>
                  </View>
                  {photos.length < MAX_PHOTOS ? (
                    <TouchableOpacity
                      onPress={pickImages}
                      style={styles.addMorePill}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add" size={15} color={THEME.colors.accentText} />
                      <Text style={styles.addMoreText}>Добавить</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

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
                      style={[styles.thumbWrap, isCover && styles.thumbWrapCover]}
                    >
                      {canRenderUri(photo.uri) ? (
                        <Image source={{ uri: photo.uri }} style={styles.thumbImg} />
                      ) : null}
                      {isCover ? (
                        <View style={styles.thumbStar}>
                          <Ionicons name="star" size={10} color={THEME.colors.accent} />
                        </View>
                      ) : null}
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
                  </TouchableOpacity>
                ) : null}
              </ScrollView>

              <Text style={styles.albumTip}>
                {photos.length > 1
                  ? 'Кадры будут плавно сменяться под музыку. Нажмите на миниатюру, чтобы сделать её обложкой.'
                  : 'Можно добавить до 6 снимков — они сложатся в живой альбом дня.'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.photoBox} onPress={pickImages} activeOpacity={0.82}>
              <View style={styles.photoEmpty}>
                <View style={styles.photoIconCircle}>
                  <Ionicons name="images-outline" size={24} color={THEME.colors.accent} />
                </View>
                <Text style={styles.photoPlaceholder}>Выбрать фотографии дня</Text>
                <Text style={styles.photoSub}>От 1 до 6 снимков из галереи</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Песня дня */}
        <View style={[styles.sectionCard, step3Done && styles.sectionCardReady]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Песня дня</Text>
              {step3Done && (
                <Ionicons name="checkmark-circle" size={16} color={THEME.colors.accent} />
              )}
            </View>
            <Text style={styles.sectionHint}>Влияет на ритм и свет</Text>
          </View>

          <View style={styles.songInputWrap}>
            <Ionicons name="musical-notes-outline" size={18} color={THEME.colors.textMuted} />
            <TextInput
              style={styles.songInput}
              placeholder="Исполнитель или название трека"
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
                <Image source={{ uri: selectedTrack.artworkUrl }} style={styles.artwork} />
              ) : (
                <View style={styles.artworkFallback}>
                  <Ionicons name="disc-outline" size={20} color={THEME.colors.accent} />
                </View>
              )}

              <View style={styles.selectedTrackInfo}>
                <Text style={styles.selectedTrackTitle} numberOfLines={1}>
                  {selectedTrack.title}
                </Text>
                <Text style={styles.sectionHint} numberOfLines={1}>
                  {selectedTrack.artist} · {selectedTrack.genre}
                </Text>
                <Text style={styles.energyTag}>
                  {describeEnergy(selectedTrack.energy)}
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
              <Text style={styles.sectionHint}>Ищем треки…</Text>
            </View>
          ) : trackError ? (
            <View style={styles.trackError}>
              <Text style={styles.errorText}>{trackError}</Text>
              {needsAuth ? (
                <TouchableOpacity onPress={() => router.push('/auth/login')}>
                  <Text style={styles.changeTrack}>Войти в аккаунт</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : tracks.length > 0 ? (
            <View style={styles.trackResults}>
              {tracks.map((track, idx) => {
                const isPlayingThis = previewingId === track.id && previewStatus.playing;
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
                        <Text style={styles.sectionHint} numberOfLines={1}>
                          {track.artist} · {track.genre}
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
            <Text style={styles.sectionHint}>Ничего не нашлось. Попробуйте другое название.</Text>
          ) : (
            <Text style={styles.sectionHint}>
              Нажмите на обложку в списке, чтобы прослушать фрагмент перед выбором.
            </Text>
          )}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            {needsAuth ? (
              <TouchableOpacity onPress={() => router.push('/auth/login')}>
                <Text style={styles.changeTrack}>Войти в аккаунт</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.cloudAIConsent}
          onPress={() => setAllowCloudAI((value) => !value)}
          activeOpacity={0.8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: allowCloudAI }}
        >
          <Ionicons
            name={allowCloudAI ? 'checkbox' : 'square-outline'}
            size={22}
            color={allowCloudAI ? THEME.colors.accent : THEME.colors.textMuted}
          />
          <View style={styles.cloudAITextWrap}>
            <Text style={styles.cloudAITitle}>Разрешить Gemini (необязательно)</Text>
            <Text style={styles.cloudAIHint}>
              Если включить, Google Gemini получит текст записи, имя и описание
              профиля, заголовки последних дней и данные песни. Фотографии не
              отправляются — оттенки вычисляются на сервере. Без согласия
              используется локальная обработка.
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, (loading || readyCount < 3) && styles.submitBtnDim]}
          onPress={handleSave}
          disabled={loading || readyCount < 3}
          activeOpacity={0.85}
        >
          <Text style={styles.submitText}>Собрать воспоминание</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal transparent visible={loading} animationType="fade">
        <View style={styles.overlayRoot}>
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color={THEME.colors.accent} />
            <Text style={styles.overlayTitle}>Собираем ваш день</Text>
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
  introBlock: {
    gap: 8,
    paddingTop: 2,
  },
  introTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 28,
    color: THEME.colors.text,
    lineHeight: 34,
  },
  introSub: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  progressCol: { flex: 1, gap: 5 },
  progressBar: {
    height: 3,
    borderRadius: 99,
    backgroundColor: THEME.colors.borderStrong,
  },
  progressBarActive: {
    backgroundColor: THEME.colors.accent,
  },
  progressLabel: {
    fontSize: 11,
    color: THEME.colors.textDim,
  },
  progressLabelActive: {
    color: THEME.colors.text,
    fontWeight: '500',
  },
  sectionCard: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: 15,
    gap: 12,
  },
  sectionCardReady: {
    borderColor: 'rgba(216, 255, 75, 0.28)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  sectionHint: {
    fontSize: 12,
    color: THEME.colors.textDim,
  },
  sectionHintReady: {
    color: THEME.colors.warmGold,
  },
  textArea: {
    backgroundColor: THEME.colors.surfaceElevated,
    color: THEME.colors.text,
    borderRadius: THEME.radius.sm,
    padding: 14,
    minHeight: 118,
    fontSize: 15,
    lineHeight: 22,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  photoBox: {
    height: 196,
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
    borderColor: THEME.colors.border,
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
    backgroundColor: 'rgba(6, 6, 9, 0.76)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.radius.pill,
  },
  coverBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  addMorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.accent,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: THEME.radius.pill,
  },
  addMoreText: {
    fontSize: 12,
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
  thumbStar: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 18,
    height: 18,
    borderRadius: 99,
    backgroundColor: 'rgba(6, 6, 9, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbDelete: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 99,
    backgroundColor: 'rgba(6, 6, 9, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbAddTile: {
    width: 66,
    height: 66,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: THEME.colors.borderStrong,
    backgroundColor: THEME.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumTip: {
    fontSize: 12,
    lineHeight: 17,
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
    paddingVertical: 4,
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
  trackResultText: { flex: 1, gap: 2 },
  trackResultTitle: { color: THEME.colors.text, fontSize: 14, fontWeight: '600' },
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
    fontSize: 11,
    color: THEME.colors.accent,
    fontWeight: '600',
    marginTop: 2,
  },
  selectedActions: {
    alignItems: 'center',
    gap: 6,
  },
  previewBtnActive: {
    width: 32,
    height: 32,
    borderRadius: 99,
    backgroundColor: THEME.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changeTrack: {
    fontSize: 12,
    color: THEME.colors.accent,
    fontWeight: '600',
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
  cloudAIConsent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
  },
  cloudAITextWrap: { flex: 1, gap: 5 },
  cloudAITitle: {
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  cloudAIHint: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  submitBtn: {
    backgroundColor: THEME.colors.accent,
    paddingVertical: 16,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDim: { opacity: 0.45 },
  submitText: {
    color: THEME.colors.accentText,
    fontWeight: '700',
    fontSize: 15,
  },
  overlayRoot: {
    flex: 1,
    backgroundColor: 'rgba(6, 6, 9, 0.84)',
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
    gap: 10,
  },
  overlayTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 22,
    color: THEME.colors.text,
    marginTop: 4,
  },
  overlayStage: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
});