export type ArtStyle = 'analog_film' | 'minimal_editorial';

export type TypographyVariant = 'serif_editorial' | 'mono_archive';

export interface TrackInfo {
  title: string;
  artist: string;
  previewUrl: string; 
  genre: string;
  energy?: number; 
}

export interface StyleRecipe {
  palette: [string, string, string]; 
  grainIntensity: number; // 0.0 - 1.0
  artStyle: ArtStyle;
  motionSpeed: number; 
  typographyVariant: TypographyVariant;
}

export interface MemoryDay {
  id: string;
  date: string;
  folderTitle: string; 
  text: string;
  photoUri: string;
  track: TrackInfo;
  style: StyleRecipe;
}