import { ArtStyle, TypographyVariant } from '../types/memory';

export interface ArtStyleMeta {
  code: string;
  canvasLabel: string;
  shortTitle: string;
  reference: string;
  principle: string;
}

export const ART_STYLE_META: Record<ArtStyle, ArtStyleMeta> = {
  analog_film: {
    code: '01',
    canvasLabel: 'Аналоговая плёнка 35мм',
    shortTitle: 'Аналоговая плёнка',
    reference: 'Плёночная фотография 35мм',
    principle:
      'Тёплая засветка, видоискатель и тактильное зерно удерживают камерное, живое ощущение момента.',
  },
  minimal_editorial: {
    code: '02',
    canvasLabel: 'Выставочная сетка',
    shortTitle: 'Выставочная сетка',
    reference: 'Швейцарская и японская минималистичная графика',
    principle:
      'Асимметричная сетка, много воздуха и сфокусированный ритм подчёркивают ясность и собранность дня.',
  },
  dreamy_aura: {
    code: '03',
    canvasLabel: 'Свет и аура',
    shortTitle: 'Свет и аура',
    reference: 'Свет и воздушная среда импрессионистов (Клод Моне)',
    principle:
      'Мягкие плавающие световые пятна и рассеянная дымка передают созерцательность и тишину.',
  },
  kinetic_zine: {
    code: '04',
    canvasLabel: 'Кинетика и ритм',
    shortTitle: 'Кинетика и ритм',
    reference: 'Геометрическая композиция и динамика (Василий Кандинский)',
    principle:
      'Диагональные векторы, контраст и ускоренный импульс отражают высокую энергию и напряжение дня.',
  },
};

export const TYPOGRAPHY_LABELS: Record<TypographyVariant, string> = {
  serif_editorial: 'Антиква (книжная, камерная)',
  mono_archive: 'Моноширинная (графичная, собранная)',
};