export type ArtStyle =
  | 'analog_film'       // Тёплая плёнка: засветка, виньетка, живое зерно
  | 'minimal_editorial' // Выставочная сетка: воздух, геометрия, спокойный фокус
  | 'dreamy_aura'       // Свет и аура: мягкие плавающие ореолы света и дымка
  | 'kinetic_zine';     // Кинетика и ритм: диагональные линии, высокий контраст, динамика

export type TypographyVariant = 'serif_editorial' | 'mono_archive';

export type MoodCategory = 'happy' | 'warm' | 'calm' | 'energetic' | 'sad';

export interface TrackInfo {
  id: number;
  title: string;
  artist: string;
  previewUrl: string;
  genre: string;
  artworkUrl: string;
  trackUrl: string;
  energy: number;
}

export interface StyleRecipe {
  palette: [string, string, string]; // [глубокий фон, акцент/свет, бумага/текст]
  grainIntensity: number;            // 0.0 - 1.0
  artStyle: ArtStyle;
  motionSpeed: number;               // 0.2 - 2.0 (темп/энергия трека)
  typographyVariant: TypographyVariant;
  atmosphereNote?: string;           // Короткая подпись на открытке
  mood?: MoodCategory;               // Категория настроения для фильтрации
  moodLabel?: string;                // Естественный тег настроения от ИИ
  curatorSummary?: string;           // Персональное объяснение оформления от ИИ
  personalizationNote?: string;      // Как описание профиля повлияло на результат
  aiGenerated?: boolean;             // Флаг, что рецепт собран ИИ-моделью
}

export interface MemoryDay {
  id: string;
  createdAt: string;
  date: string;
  folderTitle: string;               // Короткое название папки (3–7 слов)
  text: string;
  photoUri: string;
  photoUris?: string[];              // Полный альбом дня (1–6 кадров)
  mood?: MoodCategory;
  track: TrackInfo;
  style: StyleRecipe;
}

export interface DraftPhoto {
  uri: string;
  base64?: string;
  mimeType?: string;
}

export function getMemoryPhotos(memory: MemoryDay): string[] {
  const result: string[] = [];
  const pushUnique = (uri?: string) => {
    const clean = uri?.trim();
    if (clean && !result.includes(clean)) {
      result.push(clean);
    }
  };

  pushUnique(memory.photoUri);
  if (Array.isArray(memory.photoUris)) {
    memory.photoUris.forEach(pushUnique);
  }
  return result;
}

export function formatMemoryDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}