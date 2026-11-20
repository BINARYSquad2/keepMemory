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
import { useRouter } from 'expo-router';
import { createMemoryMock } from '../../services/memoryStore';

export default function CreateDayScreen() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [songQuery, setSongQuery] = useState('');
  const [loading, setLoading] = useState(false);

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
        'Заполни все поля',
        'Для воспоминания нужны текст о дне, хотя бы одно фото и песня.'
      );
      return;
    }

    try {
      setLoading(true);
      const created = await createMemoryMock({
        text: text.trim(),
        photoUri,
        songQuery: songQuery.trim(),
      });

      // Сбрасываем форму
      setText('');
      setPhotoUri(null);
      setSongQuery('');

      // Пока переходим в архив (на следующем шаге откроем сразу экран /memory/[id])
      router.push('/');
      Alert.alert('Папка создана', `«${created.folderTitle}» добавлена в архив.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>1. Ощущение и события дня</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Опиши свет, погоду, детали и настроение дня..."
        placeholderTextColor="#666670"
        multiline
        value={text}
        onChangeText={setText}
        textAlignVertical="top"
      />

      <Text style={styles.label}>2. Фотография дня</Text>
      <TouchableOpacity style={styles.photoBox} onPress={pickImage}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
        ) : (
          <Text style={styles.photoPlaceholder}>+ Выбрать фото из галереи</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>3. Песня этого дня (название или ссылка)</Text>
      <TextInput
        style={styles.input}
        placeholder="Например: Kino - Spokoynaya Noch"
        placeholderTextColor="#666670"
        value={songQuery}
        onChangeText={setSongQuery}
      />

      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#0E0E10" />
        ) : (
          <Text style={styles.submitText}>Собрать воспоминание</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E0E10' },
  content: { padding: 20, paddingBottom: 40 },
  label: {
    color: '#A0A0AB',
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
  },
  textArea: {
    backgroundColor: '#18181C',
    color: '#F4F1EA',
    borderRadius: 12,
    padding: 14,
    minHeight: 120,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#27272E',
  },
  photoBox: {
    height: 220,
    borderRadius: 12,
    backgroundColor: '#18181C',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#3A3A44',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photoPlaceholder: { color: '#9A9AA6', fontSize: 15 },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  input: {
    backgroundColor: '#18181C',
    color: '#F4F1EA',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#27272E',
  },
  submitBtn: {
    marginTop: 28,
    backgroundColor: '#E89B4B',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#0E0E10', fontWeight: '700', fontSize: 16 },
});