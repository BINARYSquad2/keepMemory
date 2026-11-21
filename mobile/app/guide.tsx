import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ArtStyle } from '../types/memory';
import { ART_STYLE_META } from '../constants/artStyles';
import { THEME } from '../constants/theme';

const STEPS = [
  {
    code: '01',
    tag: 'ЗАПИСЬ',
    title: 'Расскажи, как ощущался день',
    body: 'Пиши свободно — коротко или подробно: погода, свет в окнах, запахи, кто был рядом. Система считывает время суток, настроение и ключевые образы.',
  },
  {
    code: '02',
    tag: 'АЛЬБОМ ФОТО',
    title: 'Приложи от 1 до 6 фотографий',
    body: 'Можно выбрать один главный кадр или собрать мини-альбом дня. В готовом воспоминании кадры плавно сменяют друг друга в ритме выбранной песни.',
  },
  {
    code: '03',
    tag: 'САУНДТРЕК',
    title: 'Добавь песню дня',
    body: 'Найди трек прямо в поиске и послушай 30-секундное превью. Энергия и жанр песни реально меняют скорость анимации, свет и эквалайзер кадра.',
  },
  {
    code: '04',
    tag: 'ПАПКА И PNG',
    title: 'Возвращайся в день и делись им',
    body: 'Каждый день попадает в папку с коротким названием (3–7 слов). Внутри можно включить музыку, перелистать альбом и сохранить открытку в PNG.',
  },
];

const MODE_ORDER: ArtStyle[] = [
  'analog_film',
  'minimal_editorial',
  'dreamy_aura',
  'kinetic_zine',
];

const MODE_SAMPLES: Record<
  ArtStyle,
  {
    bg: string;
    accent: string;
    light: string;
    when: string;
    exampleDay: string;
    visualCue: string;
  }
> = {
  analog_film: {
    bg: '#1D1410',
    accent: '#E89B54',
    light: '#F5E8D8',
    when: 'Камерные вечера, прогулки, ностальгия, тёплый свет, инди / джаз / акустика.',
    exampleDay: '«Осенний парк и тёплое какао»',
    visualCue: 'Уголки видоискателя 35мм, живая засветка и тактильное плёночное зерно.',
  },
  minimal_editorial: {
    bg: '#10151C',
    accent: '#7FE3FF',
    light: '#EAF1F8',
    when: 'Собранные рабочие дни, ясное утро, фокус, минимализм и лоу-фай.',
    exampleDay: '«Утренний свет и тихий фокус»',
    visualCue: 'Асимметричная швейцарская сетка, приводные метки и много воздуха.',
  },
  dreamy_aura: {
    bg: '#151221',
    accent: '#C99BFF',
    light: '#F3EBFF',
    when: 'Дождь, закаты, созерцательные и тихие дни, эмбиент, неоклассика.',
    exampleDay: '«Вечерний дождь и мягкий свет»',
    visualCue: 'Плавающие световые ореолы в духе Клода Моне и мягкое дыхание цвета.',
  },
  kinetic_zine: {
    bg: '#141118',
    accent: '#D8FF4B',
    light: '#F4EFE6',
    when: 'Драйв, дедлайны, спорт, ночной город, электроника, хип-хоп и рок.',
    exampleDay: '«Ночь перед сдачей проекта»',
    visualCue: 'Диагональные векторы, контраст и геометрический пульс Кандинского.',
  },
};

export default function GuideScreen() {
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<ArtStyle>('analog_film');

  const modeMeta = ART_STYLE_META[activeMode];
  const sample = MODE_SAMPLES[activeMode];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Шапка */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={styles.backBtn}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-back" size={18} color={THEME.colors.text} />
          <Text style={styles.backText}>Назад</Text>
        </TouchableOpacity>
        <Text style={styles.topTag}>[GUIDE.EXE // ARTTECH]</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroCornerTL} />
          <View style={styles.heroCornerBR} />

          <Text style={styles.eyebrow}>• KEEPMEMORY // ART_DIARY_SYSTEM</Text>
          <Text style={styles.heroTitle}>Make the Invisible Visible_</Text>
          <Text style={styles.heroQuote}>
            Фотографии помнят, как выглядел день. KeepMemory сохраняет, как он ощущался —
            через слова, свет кадра, альбом и музыку.
          </Text>

          <View style={styles.metaStrip}>
            <View style={styles.metaCell}>
              <Text style={styles.metaKey}>ВВОД</Text>
              <Text style={styles.metaVal}>Текст · Фото · Трек</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaCell}>
              <Text style={styles.metaKey}>ДВИЖОК</Text>
              <Text style={styles.metaVal}>4 арт-режима Skia</Text>
            </View>
          </View>
        </View>

        {/* 01 // Пошаговое управление */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>01 // КАК УПРАВЛЯТЬ ПРИЛОЖЕНИЕМ</Text>
          <View style={styles.stepsCol}>
            {STEPS.map((step) => (
              <View key={step.code} style={styles.stepBox}>
                <View style={styles.stepTop}>
                  <Text style={styles.stepCode}>{step.code} //</Text>
                  <Text style={styles.stepTag}>{step.tag}</Text>
                </View>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 02 // Дерево связи ввода и результата */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>02 // ИЗ ЧЕГО СТРОИТСЯ ВОСПОМИНАНИЕ</Text>
          <View style={styles.treeCard}>
            <Text style={styles.treeLead}>
              Система глубже схемы «грустно = синий» — каждый канал ввода управляет своими слоями:
            </Text>

            <View style={styles.treeRow}>
              <Text style={styles.treeGlyph}>├</Text>
              <View style={styles.treeContent}>
                <Text style={styles.treeTitle}>Текст дня</Text>
                <Text style={styles.treeSub}>
                  Формирует короткое название папки (3–7 слов), интонацию типографики (антиква или моно) и уникальную кураторскую заметку.
                </Text>
              </View>
            </View>

            <View style={styles.treeRow}>
              <Text style={styles.treeGlyph}>├</Text>
              <View style={styles.treeContent}>
                <Text style={styles.treeTitle}>Фотографии и альбом</Text>
                <Text style={styles.treeSub}>
                  Задают 3-цветную палитру (фон, свет, бумага), зернистость и последовательность смены кадров.
                </Text>
              </View>
            </View>

            <View style={styles.treeRow}>
              <Text style={styles.treeGlyph}>└</Text>
              <View style={styles.treeContent}>
                <Text style={styles.treeTitle}>Песня и её энергия</Text>
                <Text style={styles.treeSub}>
                  Управляет скоростью анимации, ритмом переключения кадров альбома и 5-полосной волной эквалайзера.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 03 // Интерактивный разбор 4 режимов */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>03 // ЕДИНАЯ ВИЗУАЛЬНАЯ СИСТЕМА</Text>
          <Text style={styles.sectionSub}>
            Нажми на любой режим, чтобы увидеть, когда он включается и на какой художественный приём опирается:
          </Text>

          <View style={styles.modeTabs}>
            {MODE_ORDER.map((mode) => {
              const meta = ART_STYLE_META[mode];
              const active = mode === activeMode;
              return (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setActiveMode(mode)}
                  activeOpacity={0.8}
                  style={[styles.modeTab, active && styles.modeTabActive]}
                >
                  <Text style={[styles.modeTabCode, active && styles.modeTabCodeActive]}>
                    {meta.code}
                  </Text>
                  <Text
                    style={[styles.modeTabTitle, active && styles.modeTabTitleActive]}
                    numberOfLines={1}
                  >
                    {meta.shortTitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Живой образец выбранного стиля */}
          <View
            style={[
              styles.specimenCard,
              { backgroundColor: sample.bg, borderColor: sample.accent },
            ]}
          >
            <View style={styles.specimenHeader}>
              <View style={styles.specimenDotRow}>
                <View style={[styles.specimenDot, { backgroundColor: sample.accent }]} />
                <Text style={[styles.specimenCode, { color: sample.accent }]}>
                  {modeMeta.canvasLabel}
                </Text>
              </View>
              <View style={styles.specimenSwatches}>
                {[sample.bg, sample.accent, sample.light].map((hex) => (
                  <View key={hex} style={[styles.swatch, { backgroundColor: hex }]} />
                ))}
              </View>
            </View>

            <Text style={[styles.specimenTitle, { color: sample.light }]}>
              {sample.exampleDay}
            </Text>

            <View style={styles.specimenBlock}>
              <Text style={styles.specimenLabel}>РЕФЕРЕНС</Text>
              <Text style={[styles.specimenText, { color: sample.light }]}>
                {modeMeta.reference}
              </Text>
            </View>

            <View style={styles.specimenBlock}>
              <Text style={styles.specimenLabel}>КОГДА ВКЛЮЧАЕТСЯ</Text>
              <Text style={styles.specimenMuted}>{sample.when}</Text>
            </View>

            <View style={styles.specimenBlock}>
              <Text style={styles.specimenLabel}>ЧТО МЕНЯЕТСЯ В КАДРЕ</Text>
              <Text style={styles.specimenMuted}>{sample.visualCue}</Text>
            </View>
          </View>
        </View>

        {/* 04 // Быстрые жесты */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>04 // БЫСТРОЕ УПРАВЛЕНИЕ</Text>
          <View style={styles.controlsGrid}>
            <View style={styles.controlItem}>
              <Ionicons name="images-outline" size={18} color={THEME.colors.accent} />
              <Text style={styles.controlTitle}>Тап по фото</Text>
              <Text style={styles.controlSub}>Листает кадры альбома вручную</Text>
            </View>
            <View style={styles.controlItem}>
              <Ionicons name="musical-notes-outline" size={18} color={THEME.colors.warmGold} />
              <Text style={styles.controlTitle}>Play / Pause</Text>
              <Text style={styles.controlSub}>Оживляет ритм и автосмену кадров</Text>
            </View>
            <View style={styles.controlItem}>
              <Ionicons name="share-outline" size={18} color={THEME.colors.cyanSignal} />
              <Text style={styles.controlTitle}>Экспорт PNG</Text>
              <Text style={styles.controlSub}>Сохраняет готовую открытку дня</Text>
            </View>
            <View style={styles.controlItem}>
              <Ionicons name="options-outline" size={18} color={THEME.colors.accent} />
              <Text style={styles.controlTitle}>Фильтр ленты</Text>
              <Text style={styles.controlSub}>Сортирует архив по стилям</Text>
            </View>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.ctaBtn}
          activeOpacity={0.85}
          onPress={() => router.replace('/(tabs)/create')}
        >
          <Text style={styles.ctaText}>ЗАПИСАТЬ СВОЙ ДЕНЬ →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingRight: 12,
  },
  backText: {
    fontFamily: THEME.fonts.serif,
    fontSize: 16,
    color: THEME.colors.text,
  },
  topTag: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: THEME.colors.accent,
  },
  scroll: {
    padding: THEME.spacing.md,
    gap: 24,
    paddingBottom: 48,
  },
  heroCard: {
    position: 'relative',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.borderStrong,
    borderRadius: THEME.radius.md,
    padding: 18,
    gap: 10,
  },
  heroCornerTL: {
    position: 'absolute',
    top: -1,
    left: -1,
    width: 16,
    height: 16,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: THEME.colors.accent,
    borderTopLeftRadius: THEME.radius.md,
  },
  heroCornerBR: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: THEME.colors.warmGold,
    borderBottomRightRadius: THEME.radius.md,
  },
  eyebrow: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.3,
    color: THEME.colors.accent,
  },
  heroTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 27,
    color: THEME.colors.text,
    lineHeight: 33,
  },
  heroQuote: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    borderLeftWidth: 2,
    borderLeftColor: THEME.colors.warmGold,
    paddingLeft: 12,
  },
  metaStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfacePanel,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.sm,
    padding: 10,
    marginTop: 4,
  },
  metaCell: { flex: 1, gap: 2 },
  metaDivider: {
    width: 1,
    height: 24,
    backgroundColor: THEME.colors.border,
    marginHorizontal: 12,
  },
  metaKey: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: THEME.colors.textDim,
  },
  metaVal: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.text,
  },
  section: { gap: 12 },
  sectionHeader: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: THEME.colors.accent,
  },
  sectionSub: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  stepsCol: { gap: 10 },
  stepBox: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: 14,
    gap: 6,
  },
  stepTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepCode: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.accent,
  },
  stepTag: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: THEME.colors.warmGold,
  },
  stepTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 18,
    color: THEME.colors.text,
  },
  stepBody: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  treeCard: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: 16,
    gap: 12,
  },
  treeLead: {
    color: THEME.colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  treeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  treeGlyph: {
    fontFamily: THEME.fonts.mono,
    fontSize: 16,
    color: THEME.colors.accent,
    lineHeight: 20,
  },
  treeContent: { flex: 1, gap: 2 },
  treeTitle: {
    fontFamily: THEME.fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  treeSub: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  modeTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeTab: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
  },
  modeTabActive: {
    borderColor: THEME.colors.accent,
    backgroundColor: THEME.colors.accentSoft,
  },
  modeTabCode: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    color: THEME.colors.textDim,
  },
  modeTabCodeActive: {
    color: THEME.colors.accent,
    fontWeight: '700',
  },
  modeTabTitle: {
    flex: 1,
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  modeTabTitleActive: {
    color: THEME.colors.text,
    fontWeight: '600',
  },
  specimenCard: {
    borderWidth: 1,
    borderRadius: THEME.radius.md,
    padding: 16,
    gap: 12,
  },
  specimenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  specimenDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  specimenDot: { width: 7, height: 7, borderRadius: 99 },
  specimenCode: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  specimenSwatches: { flexDirection: 'row', gap: 5 },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  specimenTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 20,
    lineHeight: 26,
  },
  specimenBlock: { gap: 3 },
  specimenLabel: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.1,
    color: 'rgba(244, 239, 230, 0.5)',
  },
  specimenText: {
    fontSize: 13,
    lineHeight: 19,
  },
  specimenMuted: {
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(244, 239, 230, 0.74)',
  },
  controlsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  controlItem: {
    width: '48.2%',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: 13,
    gap: 5,
  },
  controlTitle: {
    fontFamily: THEME.fonts.mono,
    fontSize: 12,
    color: THEME.colors.text,
    fontWeight: '700',
    marginTop: 2,
  },
  controlSub: {
    fontSize: 11,
    lineHeight: 16,
    color: THEME.colors.textMuted,
  },
  ctaBtn: {
    backgroundColor: THEME.colors.accent,
    paddingVertical: 16,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: THEME.fonts.mono,
    color: THEME.colors.accentText,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
});