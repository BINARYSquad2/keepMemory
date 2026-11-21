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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ApiError,
  createDay,
  getErrorMessage,
  searchTracks,
} from '../../services/api';
import { TrackInfo } from '../../types/memory';
import { THEME } from '../../constants/theme';

export default function CreateDayScreen() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [songQuery, setSongQuery] = useState('');
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<TrackInfo | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readyCount = [
    text.trim().length >= 10,
    Boolean(photoUri),
    Boolean(selectedTrack),
  ].filter(Boolean).length;

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

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Нужен доступ', 'Разреши доступ к галерее, чтобы выбрать фото дня.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (pickerError) {
      setError(getErrorMessage(pickerError));
    }
  };

  const handleSave = async () => {
    if (loading) return;
    if (text.trim().length < 10 || !photoUri || !selectedTrack) {
      setError('Нужны текст минимум из 10 символов, фотография и выбранный трек из результатов поиска.');
      return;
    }

    try {
      setError(null);
      setLoading(true);
      const created = await createDay({
        text: text.trim(),
        photoUri,
        track: selectedTrack,
      });

      setText('');
      setPhotoUri(null);
      setSongQuery('');
      setSelectedTrack(null);

      router.push(`/memory/${created.id}`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setNeedsAuth(requestError instanceof ApiError && requestError.status === 401);
    } finally {
      setLoading(false);
    }
  };

  return (
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
          Система соединит твои слова, свет фотографии и ритм трека в живую страницу дневника.
        </Text>
        <View style={styles.progressRow}>
          {[1, 2, 3].map((step) => (
            <View
              key={step}
              style={[
                styles.progressBar,
                readyCount >= step && styles.progressBarActive,
              ]}
            />
          ))}
          <Text style={styles.progressText}>{readyCount}/3</Text>
        </View>
      </View>

      {/* ШАГ 01 */}
      <View style={styles.stepCard}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTag}>01 · Слова</Text>
          <Text style={styles.stepHint}>Погода, свет, настроение</Text>
        </View>
        <TextInput
          style={styles.textArea}
          placeholder="Каким был этот день на ощупь? Например: шёл тёплый дождь, в окнах горел жёлтый свет..."
          placeholderTextColor={THEME.colors.textDim}
          multiline
          maxLength={4000}
          value={text}
          onChangeText={setText}
          textAlignVertical="top"
        />
      </View>

      {/* ШАГ 02 */}
      <View style={styles.stepCard}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTag}>02 · Кадр дня</Text>
          <Text style={styles.stepHint}>Станет основой палитры</Text>
        </View>
        <TouchableOpacity style={styles.photoBox} onPress={pickImage} activeOpacity={0.8}>
          {photoUri ? (
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
      <View style={styles.stepCard}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTag}>03 · САУНДТРЕК</Text>
          <Text style={styles.stepHint}>Выбери официальный preview трека</Text>
        </View>
        <View style={styles.songInputWrap}>
          <Ionicons name="musical-notes-outline" size={18} color={THEME.colors.accent} />
          <TextInput
            style={styles.songInput}
            placeholder="Исполнитель или название песни"
            placeholderTextColor={THEME.colors.textDim}
            value={songQuery}
            onChangeText={(value) => {
              setSongQuery(value);
              setSelectedTrack(null);
              setTracks([]);
              setTrackError(null);
              setNeedsAuth(false);
              setTrackLoading(value.trim().length >= 2);
              setError(null);
            }}
          />
        </View>

        {selectedTrack ? (
          <View style={styles.selectedTrack}>
            <View style={styles.selectedTrackInfo}>
              <Text style={styles.selectedTrackTitle} numberOfLines={1}>
                {selectedTrack.title}
              </Text>
              <Text style={styles.stepHint} numberOfLines={1}>
                {selectedTrack.artist} · {selectedTrack.genre}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedTrack(null)}>
              <Text style={styles.changeTrack}>Изменить</Text>
            </TouchableOpacity>
          </View>
        ) : trackLoading ? (
          <ActivityIndicator color={THEME.colors.accent} />
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
            {tracks.map((track) => (
              <TouchableOpacity
                key={track.id}
                style={styles.trackResult}
                onPress={() => setSelectedTrack(track)}
              >
                <View style={styles.trackResultText}>
                  <Text style={styles.trackResultTitle} numberOfLines={1}>{track.title}</Text>
                  <Text style={styles.stepHint} numberOfLines={1}>
                    {track.artist} · {track.genre}
                  </Text>
                </View>
                <Ionicons name="add-circle-outline" size={20} color={THEME.colors.accent} />
              </TouchableOpacity>
            ))}
          </View>
        ) : songQuery.trim().length >= 2 ? (
          <Text style={styles.stepHint}>Подходящих треков с preview не найдено.</Text>
        ) : (
          <Text style={styles.stepHint}>Введите минимум 2 символа для поиска.</Text>
        )}
      </View>

      {error ? (
        <View style={styles.trackError}>
          <Text style={styles.errorText}>{error}</Text>
          {needsAuth ? (
            <TouchableOpacity onPress={() => router.push('/auth/login')}>
              <Text style={styles.changeTrack}>Войти в аккаунт</Text>
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
        {loading ? (
          <ActivityIndicator color={THEME.colors.accentText} />
        ) : (
          <Text style={styles.submitText}>СОБРАТЬ ВОСПОМИНАНИЕ →</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  content: {
    padding: THEME.spacing.md,
    gap: 16,
    paddingBottom: 40, // Запас под парящий док
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
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepTag: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.accent,
    letterSpacing: 1,
  },
  stepHint: {
    fontSize: 11,
    color: THEME.colors.textDim,
  },
  textArea: {
    backgroundColor: THEME.colors.surfaceElevated,
    color: THEME.colors.text,
    borderRadius: THEME.radius.sm,
    padding: 14,
    minHeight: 110,
    fontSize: 15,
    lineHeight: 22,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  photoBox: {
    height: 210,
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
  trackResults: {
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.sm,
    overflow: 'hidden',
  },
  trackResult: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  trackResultText: { flex: 1, gap: 3 },
  trackResultTitle: { color: THEME.colors.text, fontSize: 13, fontWeight: '600' },
  selectedTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.accent,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.accentSoft,
  },
  selectedTrackInfo: { flex: 1, gap: 4 },
  selectedTrackTitle: { color: THEME.colors.text, fontSize: 14, fontWeight: '700' },
  changeTrack: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.accent,
  },
  trackError: { gap: 8 },
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
  submitBtnDim: { opacity: 0.55 },
  submitText: {
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.accentText,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1.1,
  },
});