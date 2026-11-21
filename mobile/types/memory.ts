export type ArtStyle =
  | 'analog_film'       // Тёплая плёнка: засветка, виньетка, живое зерно
  | 'minimal_editorial' // Выставочный постер: тонкая сетка, кинетический маркер ритма
  | 'dreamy_aura'       // Эфирная аура: мягкие плавающие ореолы света и туман
  | 'kinetic_zine';     // ArtTech-зин: диагональные световые лучи, высокий контраст, быстрый пульс

export type TypographyVariant = 'serif_editorial' | 'mono_archive';

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
  atmosphereNote?: string;           // Краткое пояснение приёма (для пользователя и жюри)
}

export interface MemoryDay {
  id: string;
  createdAt: string;
  date: string;
  folderTitle: string; // 3-7 слов
  text: string;
  photoUri: string;
  photoUris?: string[]; // Полный альбом дня (1–6 кадров)
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