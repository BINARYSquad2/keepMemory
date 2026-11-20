import React, { useState } from 'react';
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
import { createMemoryMock } from '../../services/memoryStore';
import { ArtStyle } from '../../types/memory';
import { THEME } from '../../constants/theme';

const STYLE_OPTIONS: { id?: ArtStyle; label: string }[] = [
  { id: undefined, label: 'Авто' },
  { id: 'analog_film', label: 'Плёнка' },
  { id: 'dreamy_aura', label: 'Аура' },
  { id: 'minimal_editorial', label: 'Сетка' },
  { id: 'kinetic_zine', label: 'Кинетика' },
];

export default function CreateDayScreen() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [songQuery, setSongQuery] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<ArtStyle | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const readyCount = [Boolean(text.trim()), Boolean(photoUri), Boolean(songQuery.trim())].filter(
    Boolean
  ).length;

  const pickImage = async () => {
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
  };

  const handleSave = async () => {
    if (!text.trim() || !photoUri || !songQuery.trim()) {
      Alert.alert(
        'Осталось чуть-чуть',
        'Чтобы собрать атмосферу дня, заполни все 3 шага: текст, фотографию и песню.'
      );
      return;
    }

    try {
      setLoading(true);
      const created = await createMemoryMock({
        text: text.trim(),
        photoUri,
        songQuery: songQuery.trim(),
        preferredMood: selectedStyle,
      });

      setText('');
      setPhotoUri(null);
      setSongQuery('');
      setSelectedStyle(undefined);

      router.push(`/memory/${created.id}`);
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
          <Text style={styles.stepHint}>Задаёт темп и характер слоёв</Text>
        </View>
        <View style={styles.songInputWrap}>
          <Ionicons name="musical-notes-outline" size={18} color={THEME.colors.accent} />
          <TextInput
            style={styles.songInput}
            placeholder="Исполнитель — название песни или ссылка"
            placeholderTextColor={THEME.colors.textDim}
            value={songQuery}
            onChangeText={setSongQuery}
          />
        </View>

        {/* Выбор настроения/режима (опционально для калибровки) */}
        <Text style={styles.modeCaption}>Визуальный акцент (можно оставить «Авто»)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {STYLE_OPTIONS.map((opt) => {
            const active = selectedStyle === opt.id;
            return (
              <TouchableOpacity
                key={opt.label}
                onPress={() => setSelectedStyle(opt.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <TouchableOpacity
        style={[
          styles.submitBtn,
          (loading || readyCount < 3) && styles.submitBtnDim,
        ]}
        onPress={handleSave}
        disabled={loading}
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
  modeCaption: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 4,
  },
  chipsRow: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: THEME.colors.accentSoft,
    borderColor: THEME.colors.accent,
  },
  chipText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  chipTextActive: {
    color: THEME.colors.accent,
    fontWeight: '700',
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