import { getMemoryPhotos, MemoryDay, MoodCategory } from '../types/memory';
import { ART_STYLE_META } from '../constants/artStyles';

export interface DayAtmosphereReading {
  moodCategory: MoodCategory;
  moodBadge: string;      // Естественный тег настроения: «Тёплый уют», «Ночной фокус»
  cardCaption: string;    // Короткая живая подпись на самой открытке
  curatorSummary: string; // Цельное объяснение оформления этого конкретного дня
  drivers: {
    text: string;
    palette: string;
    music: string;
    album: string;
  };
}

interface PaletteMetrics {
  temperature: 'warm' | 'cool' | 'neutral' | 'vivid';
  tempLabel: string;
  contrastLabel: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '').replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [30, 30, 40];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [Math.round(h * 60), s, l];
}

function analyzePalette(palette: [string, string, string]): PaletteMetrics {
  const [bgHex = '#060609', accentHex = '#D8FF4B', lightHex = '#F4EFE6'] = palette ?? [];
  const [ar, ag, ab] = hexToRgb(accentHex);
  const [hue, sat] = rgbToHsl(ar, ag, ab);
  const bgL = rgbToHsl(...hexToRgb(bgHex))[2];
  const lightL = rgbToHsl(...hexToRgb(lightHex))[2];
  const contrast = Math.abs(lightL - bgL);

  let temperature: PaletteMetrics['temperature'] = 'neutral';
  let tempLabel = 'сдержанная нейтральная палитра';

  if (sat < 0.16) {
    temperature = 'neutral';
    tempLabel = 'приглушённая графитовая гамма без лишнего шума';
  } else if ((hue >= 0 && hue <= 58) || hue >= 325) {
    temperature = 'warm';
    tempLabel =
      hue <= 28
        ? 'тёплая терракотово-янтарная палитра'
        : 'золотисто-охристая согревающая палитра';
  } else if (hue >= 60 && hue <= 155 && sat > 0.55) {
    temperature = 'vivid';
    tempLabel = 'контрастная яркая палитра с живым акцентом';
  } else {
    temperature = 'cool';
    tempLabel =
      hue >= 245
        ? 'глубокая сумеречно-лиловая палитра'
        : 'прохладная сине-стальная палитра';
  }

  const contrastLabel =
    contrast > 0.65
      ? 'высокий световой контраст'
      : contrast > 0.42
        ? 'сбалансированная глубина теней'
        : 'мягкие приглушённые полутона';

  return { temperature, tempLabel, contrastLabel };
}

interface MoodSignal {
  id: string;
  category: MoodCategory;
  badge: string;
  captionHint: string;
  textCue: string;
  patterns: RegExp[];
}

const MOOD_SIGNALS: MoodSignal[] = [
  {
    id: 'cozy',
    category: 'warm',
    badge: 'Тёплый уют',
    captionHint: 'Камерный свет и мягкое зерно удерживают тепло этого дня.',
    textCue: 'уютные детали, тепло и неспешная близость',
    patterns: [/какао|кофе|чай|плед|уют|дом|тепл|тёпл|камин|ламп|разговор|обнят|сладк|выпеч/i],
  },
  {
    id: 'rain_autumn',
    category: 'sad',
    badge: 'Осенняя меланхолия',
    captionHint: 'Приглушённый свет и воздух в кадре сохраняют тихую глубину погоды.',
    textCue: 'осенние оттенки, дождь или прохладный воздух',
    patterns: [/дожд|ливн|осен|листь|лужи|пасмур|туман|ветер|холод|мокр|зонт|серы/i],
  },
  {
    id: 'night_focus',
    category: 'energetic',
    badge: 'Ночной фокус',
    captionHint: 'Собранная геометрия и ночной контраст фиксируют напряжение момента.',
    textCue: 'ночное время, концентрация, код или срочные задачи',
    patterns: [/ноч|полноч|дедлайн|сдач|проект|офис|код|учеб|учёб|экзам|срочн|работ|экран|поздн/i],
  },
  {
    id: 'drive_energy',
    category: 'energetic',
    badge: 'Высокий драйв',
    captionHint: 'Ускоренный пульс и диагонали передают живой ритм движения.',
    textCue: 'движение, азарт, тренировка или насыщенный темп событий',
    patterns: [/драйв|бег|спорт|тренир|концерт|танц|побед|успел|огонь|быстр|энерг|зал|матч|игр/i],
  },
  {
    id: 'walk_city',
    category: 'warm',
    badge: 'Дыхание прогулки',
    captionHint: 'Живые переходы света передают ощущение дороги и открытого пространства.',
    textCue: 'прогулка, улицы, парк или смена локаций',
    patterns: [/гуля|парк|улиц|город|дорог|поездк|набереж|пруд|лес|горы|море|метро|велосипед|пешком/i],
  },
  {
    id: 'morning_clarity',
    category: 'happy',
    badge: 'Утренняя ясность',
    captionHint: 'Чистая сетка и свежий свет подчёркивают лёгкое начало дня.',
    textCue: 'утренний свет, свежесть и ясное настроение',
    patterns: [/утр|рассвет|солнц|просну|завтрак|свеж|ясн|небо|весна|чист/i],
  },
  {
    id: 'sunset_dream',
    category: 'calm',
    badge: 'Закатное созерцание',
    captionHint: 'Плавающие ореолы света растягивают тихий момент на границе вечера.',
    textCue: 'вечерний свет, закат и спокойное созерцание',
    patterns: [/закат|вечер|сумерк|небо|звезд|звёзд|луна|тих|спокой|мечт|музык|окн/i],
  },
  {
    id: 'people_joy',
    category: 'happy',
    badge: 'Живое присутствие',
    captionHint: 'Тёплый акцент и живая фактура сохраняют эмоции встречи.',
    textCue: 'люди рядом, смех и тёплое общение',
    patterns: [/друз|подруг|девушк|парен|семь|мама|папа|брат|сестр|смея|смех|встрет|праздн|радост|счаст/i],
  },
  {
    id: 'quiet_tired',
    category: 'sad',
    badge: 'Тихая пауза',
    captionHint: 'Рассеянная дымка и замедленный ритм оставляют пространство для выдоха.',
    textCue: 'усталость, тишина или желание замедлиться',
    patterns: [/устал|груст|тяжел|тяжёл|один|тишин|молча|выдох|отдох|сон|спать|тоск/i],
  },
];

function stableIndex(seed: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  }
  return h % mod;
}

function normalizeSentenceCase(value: string): string {
  const clean = value.trim();
  if (!clean) return '';
  if (clean === clean.toUpperCase()) {
    const lower = clean.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function analyzeDayAtmosphere(memory: MemoryDay): DayAtmosphereReading {
  const text = (memory.text || '').trim();
  const matched = MOOD_SIGNALS.filter((sig) =>
    sig.patterns.some((rx) => rx.test(text))
  );

  const paletteMetrics = analyzePalette(memory.style.palette);
  const energy = Math.min(1, Math.max(0.1, memory.track.energy ?? 0.5));
  const energyPct = Math.round(energy * 100);
  const speed = Number(memory.style.motionSpeed || 1);
  const grainPct = Math.round((memory.style.grainIntensity ?? 0.35) * 100);
  const photoCount = Math.max(1, getMemoryPhotos(memory).length);
  const modeMeta = ART_STYLE_META[memory.style.artStyle] ?? ART_STYLE_META.analog_film;

  const primarySignal = matched[0];
  const secondarySignal = matched[1];

  const fallbackByEnergy: {
    category: MoodCategory;
    badge: string;
    textCue: string;
    captionHint: string;
  } =
    energy >= 0.72
      ? {
          category: 'energetic',
          badge: 'Импульс дня',
          textCue: 'энергичная динамика записи и плотный ритм событий',
          captionHint: 'Сфокусированный свет и ускоренный ритм удерживают импульс этого дня.',
        }
      : paletteMetrics.temperature === 'warm'
        ? {
            category: 'warm',
            badge: 'Тёплое воспоминание',
            textCue: 'живые бытовые штрихи и мягкая интонация рассказа',
            captionHint: 'Тёплый свет кадра и живая фактура бережно хранят ощущение дня.',
          }
        : paletteMetrics.temperature === 'cool'
          ? {
              category: 'calm',
              badge: 'Вечерняя глубина',
              textCue: 'сдержанная, вдумчивая интонация дневниковой записи',
              captionHint: 'Прохладные оттенки и спокойное движение слоёв подчёркивают глубину дня.',
            }
          : {
              category: 'calm',
              badge: 'Личный слепок',
              textCue: 'наблюдения дня и спокойный авторский тон',
              captionHint: 'Выверенный баланс света, шрифта и ритма фиксирует настроение момента.',
            };

  const serverMood = memory.mood ?? memory.style.mood;
  const moodCategory: MoodCategory =
    serverMood ?? primarySignal?.category ?? fallbackByEnergy.category;

  const serverMoodLabel = memory.style.moodLabel?.trim();
  const moodBadge = serverMoodLabel
    ? normalizeSentenceCase(serverMoodLabel)
    : primarySignal?.badge ?? fallbackByEnergy.badge;

  const musicTempoWord =
    energy >= 0.72
      ? 'высокий драйв'
      : energy >= 0.46
        ? 'уверенный живой ритм'
        : 'спокойный камерный темп';

  const musicDriver = `«${memory.track.title}» (${memory.track.artist}, ${memory.track.genre}) задаёт ${musicTempoWord} (${energyPct}% энергии), поэтому слои и переходы движутся со скоростью ${speed.toFixed(1)}x.`;

  const wordCount = text ? text.split(/\s+/).length : 0;
  const textDepth =
    wordCount >= 28 ? 'подробная история' : wordCount >= 12 ? 'ёмкая заметка' : 'лаконичный штрих';
  const combinedCues = secondarySignal
    ? `${primarySignal.textCue}, а также ${secondarySignal.textCue}`
    : primarySignal?.textCue ?? fallbackByEnergy.textCue;

  const personalizationNote = memory.style.personalizationNote?.trim();
  const baseTextDriver = `В тексте (${textDepth}) проявились ${combinedCues} — это определило режим «${modeMeta.shortTitle}» и подачу заголовка «${memory.folderTitle}».`;
  const textDriver = personalizationNote
    ? `${baseTextDriver} ${personalizationNote}`
    : baseTextDriver;

  const paletteDriver = `Из фотографии извлечена ${paletteMetrics.tempLabel} и ${paletteMetrics.contrastLabel}; зернистость настроена на ${grainPct}%.`;

  const albumDriver =
    photoCount > 1
      ? `Альбом из ${photoCount} кадров плавно сменяется в такт песне, собирая день в цельную серию (${modeMeta.reference}).`
      : `Одиночный кадр работает как выставочная открытка с приёмом «${modeMeta.reference}».`;

  const captionVariants = [
    primarySignal?.captionHint ?? fallbackByEnergy.captionHint,
    `${modeMeta.shortTitle} и ${paletteMetrics.tempLabel} под ритм «${memory.track.title}».`,
    `${moodBadge}: ${paletteMetrics.contrastLabel} и ${musicTempoWord} выбранной песни.`,
  ];
  const generatedCaption =
    captionVariants[stableIndex(`${memory.id}:${memory.track.title}`, captionVariants.length)];

  const backendNote = memory.style.atmosphereNote?.trim() ?? '';
  const isGenericBackendNote =
    !backendNote ||
    backendNote.length < 18 ||
    /^(тёплая плёнка|выставочный постер|эфирная аура|arttech-зин)/i.test(backendNote);

  const cardCaption = isGenericBackendNote ? generatedCaption : backendNote;

  const serverSummary = memory.style.curatorSummary?.trim();
  const fallbackSummary =
    `Этот день собран в настроении «${moodBadge.toLowerCase()}»: ${paletteMetrics.tempLabel} соединяется с приёмом «${modeMeta.shortTitle}». ` +
    `Песня «${memory.track.title}» (${energyPct}%) задаёт ${musicTempoWord} (${speed.toFixed(1)}x)` +
    (photoCount > 1
      ? ` и темп перелистывания альбома из ${photoCount} кадров.`
      : ` и дыхание световых слоёв в кадре.`);

  const curatorSummary = serverSummary || fallbackSummary;

  return {
    moodCategory,
    moodBadge,
    cardCaption,
    curatorSummary,
    drivers: {
      text: textDriver,
      palette: paletteDriver,
      music: musicDriver,
      album: albumDriver,
    },
  };
}