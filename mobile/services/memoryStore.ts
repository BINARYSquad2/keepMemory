import { MemoryDay } from '../types/memory';

//мог мог мог мог
let memories: MemoryDay[] = [
  {
    id: 'day_001',
    date: '19 нояб. 2026',
    folderTitle: 'Тёплый вечер после дождя',
    text: 'Шёл домой мимо мокрых фонарей, воздух пах озоном и кофе. В наушниках играл спокойный инди-трек, и город казался замедленным.',
    photoUri: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800',
    track: {
      title: 'Midnight City Echo',
      artist: 'Sample Artist',
      previewUrl: '',
      genre: 'indie',
      energy: 0.45,
    },
    style: {
      palette: ['#181B24', '#E89B4B', '#F2EDE4'],
      grainIntensity: 0.45,
      artStyle: 'analog_film',
      motionSpeed: 0.5,
      typographyVariant: 'serif_editorial',
    },
  },
  {
    id: 'day_002',
    date: '20 нояб. 2026',
    folderTitle: 'Холодное утро и быстрый ритм',
    text: 'Вышел рано, небо было почти белым, город только просыпался. Энергичный бит задал темп всему дню.',
    photoUri: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800',
    track: {
      title: 'Morning Pulse',
      artist: 'Sample Electronic',
      previewUrl: '',
      genre: 'electronic',
      energy: 0.85,
    },
    style: {
      palette: ['#121417', '#5B8FB9', '#E6EEF4'],
      grainIntensity: 0.25,
      artStyle: 'minimal_editorial',
      motionSpeed: 1.4,
      typographyVariant: 'mono_archive',
    },
  },
];

export function getMemories(): MemoryDay[] {
  return memories;
}

export function getMemoryById(id: string): MemoryDay | undefined {
  return memories.find((m) => m.id === id);
}

// я тебя могну
export async function createMemoryMock(input: {
  text: string;
  photoUri: string;
  songQuery: string;
}): Promise<MemoryDay> {
  const isFast =
    input.songQuery.toLowerCase().includes('phonk') ||
    input.songQuery.toLowerCase().includes('rock') ||
    input.text.length > 120;

  const newMemory: MemoryDay = {
    id: `day_${Date.now()}`,
    date: new Date().toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    folderTitle: isFast ? 'Шумный день на высокой скорости' : 'Тихий момент в памяти дня',
    text: input.text,
    photoUri: input.photoUri,
    track: {
      title: input.songQuery || 'Без названия',
      artist: 'Поиск трека (мок)',
      previewUrl: '',
      genre: isFast ? 'electronic' : 'ambient',
      energy: isFast ? 0.85 : 0.4,
    },
    style: isFast
      ? {
          palette: ['#121417', '#D9534F', '#F4F4F4'],
          grainIntensity: 0.2,
          artStyle: 'minimal_editorial',
          motionSpeed: 1.5,
          typographyVariant: 'mono_archive',
        }
      : {
          palette: ['#1C1917', '#D4A373', '#FAEDCD'],
          grainIntensity: 0.5,
          artStyle: 'analog_film',
          motionSpeed: 0.5,
          typographyVariant: 'serif_editorial',
        },
  };

  memories = [newMemory, ...memories];
  return newMemory;
}