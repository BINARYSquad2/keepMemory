export type ArtStyle =
  | 'analog_film'
  | 'minimal_editorial'
  | 'dreamy_aura'
  | 'kinetic_zine';

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
  palette: [string, string, string];
  grainIntensity: number;
  artStyle: ArtStyle;
  motionSpeed: number;
  typographyVariant: TypographyVariant;
  atmosphereNote?: string;
  mood?: MoodCategory;
  moodLabel?: string;
  curatorSummary?: string;
  personalizationNote?: string;
  aiGenerated?: boolean;
}

export interface MemoryDay {
  id: string;
  createdAt: string;
  date: string;
  folderTitle: string;
  text: string;
  photoUri: string;
  photoUris?: string[];
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