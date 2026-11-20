import { ArtStyle, MemoryDay } from '../types/memory';

let memories: MemoryDay[] = [
  {
    id: 'day_001',
    date: '19 нояб. 2026',
    folderTitle: 'Тёплый вечер после дождя',
    text: 'Шёл домой мимо мокрых фонарей, воздух пах озоном и кофе. В наушниках играл спокойный инди-трек, и город казался замедленным.',
    photoUri: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=900',
    track: {
      title: 'Midnight City Echo',
      artist: 'Nocturne Tape',
      previewUrl: '',
      genre: 'indie',
      energy: 0.42,
    },
    style: {
      palette: ['#13141C', '#E69A52', '#F4EFE6'],
      grainIntensity: 0.55,
      artStyle: 'analog_film',
      motionSpeed: 0.48,
      typographyVariant: 'serif_editorial',
      atmosphereNote: 'Мягкая плёночная засветка и тёплое зерно передают влажный свет вечерних фонарей.',
    },
  },
  {
    id: 'day_002',
    date: '20 нояб. 2026',
    folderTitle: 'Электрический ритм ночных улиц',
    text: 'Вышел поздно, город гудел, неоновые вывески отражались в стекле. Быстрый электронный бит держал в фокусе всю дорогу.',
    photoUri: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=900',
    track: {
      title: 'Neon Overdrive',
      artist: 'Kinetika',
      previewUrl: '',
      genre: 'electronic',
      energy: 0.9,
    },
    style: {
      palette: ['#0B0D12', '#D8FF4B', '#EEF2F7'],
      grainIntensity: 0.28,
      artStyle: 'kinetic_zine',
      motionSpeed: 1.55,
      typographyVariant: 'mono_archive',
      atmosphereNote: 'Диагональные световые лучи и высокий темп движения отражают динамику трека.',
    },
  },
  {
    id: 'day_003',
    date: '20 нояб. 2026',
    folderTitle: 'Тихий рассвет над туманным полем',
    text: 'Проснулся раньше всех. За окном стоял мягкий серебристый туман, и хотелось просто молчать и слушать эмбиент.',
    photoUri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=900',
    track: {
      title: 'Floating Mist',
      artist: 'Sora Ambient',
      previewUrl: '',
      genre: 'ambient',
      energy: 0.3,
    },
    style: {
      palette: ['#10151C', '#8AB4F8', '#EDF2FA'],
      grainIntensity: 0.35,
      artStyle: 'dreamy_aura',
      motionSpeed: 0.38,
      typographyVariant: 'serif_editorial',
      atmosphereNote: 'Плавающие ореолы света и рассеянная виньетка создают ощущение тишины и воздуха.',
    },
  },
];

export function getMemories(): MemoryDay[] {
  return memories;
}

export function getMemoryById(id: string): MemoryDay | undefined {
  return memories.find((m) => m.id === id);
}

export async function createMemoryMock(input: {
  text: string;
  photoUri: string;
  songQuery: string;
  preferredMood?: ArtStyle;
}): Promise<MemoryDay> {
  const q = `${input.text} ${input.songQuery}`.toLowerCase();

  let pickedStyle: ArtStyle = input.preferredMood || 'analog_film';
  if (!input.preferredMood) {
    if (q.includes('rock') || q.includes('phonk') || q.includes('бит') || q.includes('быстр')) {
      pickedStyle = 'kinetic_zine';
    } else if (q.includes('туман') || q.includes('сон') || q.includes('ambient') || q.includes('тих')) {
      pickedStyle = 'dreamy_aura';
    } else if (q.includes('утро') || q.includes('город') || q.includes('миним')) {
      pickedStyle = 'minimal_editorial';
    }
  }

  const presets: Record<ArtStyle, { title: string; style: MemoryDay['style']; genre: string }> = {
    analog_film: {
      title: 'Тёплый кадр из памяти дня',
      genre: 'indie',
      style: {
        palette: ['#161311', '#E69A52', '#F5EFE6'],
        grainIntensity: 0.55,
        artStyle: 'analog_film',
        motionSpeed: 0.5,
        typographyVariant: 'serif_editorial',
        atmosphereNote: 'Аналоговое зерно и мягкий световой блик удерживают камерную теплоту момента.',
      },
    },
    minimal_editorial: {
      title: 'Чистая геометрия этого дня',
      genre: 'alt-pop',
      style: {
        palette: ['#0E1014', '#A7B6C7', '#F2F4F7'],
        grainIntensity: 0.22,
        artStyle: 'minimal_editorial',
        motionSpeed: 0.85,
        typographyVariant: 'mono_archive',
        atmosphereNote: 'Выставочная сетка и собранная типографика фокусируют внимание на деталях кадра.',
      },
    },
    dreamy_aura: {
      title: 'Лёгкое эхо спокойного момента',
      genre: 'ambient',
      style: {
        palette: ['#0E131A', '#9E8CFF', '#EFEFF8'],
        grainIntensity: 0.35,
        artStyle: 'dreamy_aura',
        motionSpeed: 0.38,
        typographyVariant: 'serif_editorial',
        atmosphereNote: 'Медленный дрейф цветовых ореолов передаёт созерцательный ритм записи.',
      },
    },
    kinetic_zine: {
      title: 'Импульс и энергия живого дня',
      genre: 'electronic',
      style: {
        palette: ['#0A0B0F', '#D8FF4B', '#F4F4F6'],
        grainIntensity: 0.3,
        artStyle: 'kinetic_zine',
        motionSpeed: 1.5,
        typographyVariant: 'mono_archive',
        atmosphereNote: 'Контрастные диагональные лучи и ускоренный ритм синхронизированы с энергией трека.',
      },
    },
  };

  const preset = presets[pickedStyle];

  const newMemory: MemoryDay = {
    id: `day_${Date.now()}`,
    date: new Date().toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    folderTitle: preset.title,
    text: input.text,
    photoUri: input.photoUri,
    track: {
      title: input.songQuery || 'Без названия',
      artist: 'Трек дня',
      previewUrl: '',
      genre: preset.genre,
      energy: preset.style.motionSpeed > 1 ? 0.88 : 0.45,
    },
    style: preset.style,
  };

  memories = [newMemory, ...memories];
  return newMemory;
}