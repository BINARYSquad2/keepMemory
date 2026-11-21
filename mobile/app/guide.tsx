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
    num: '1',
    title: 'Расскажите о дне своими словами',
    body: 'Коротко или подробно: погода, свет, запахи, люди рядом. Алгоритм учитывает не только саму запись, но и описание вашего профиля, чтобы оформление отражало именно ваш стиль.',
  },
  {
    num: '2',
    title: 'Добавьте от 1 до 6 фотографий',
    body: 'Можно загрузить один главный кадр или собрать мини-альбом. В готовом воспоминании снимки плавно сменяют друг друга в ритме выбранной песни.',
  },
  {
    num: '3',
    title: 'Выберите песню дня',
    body: 'Найдите трек в поиске и послушайте короткий фрагмент перед выбором. Характер и энергия музыки влияют на темп анимации, свет и динамику кадра.',
  },
  {
    num: '4',
    title: 'Возвращайтесь к дню в архиве',
    body: 'Каждый день сохраняется в отдельную папку с коротким названием. Записи сгруппированы по неделям, их можно искать и фильтровать по настроению, а открытку — сохранить в PNG.',
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
    when: 'Камерные вечера, прогулки, тёплый свет, инди, джаз и акустика.',
    exampleDay: '«Осенний парк и тёплое какао»',
    visualCue: 'Видоискатель 35мм, живая засветка и мягкое плёночное зерно.',
  },
  minimal_editorial: {
    bg: '#10151C',
    accent: '#7FE3FF',
    light: '#EAF1F8',
    when: 'Ясное утро, спокойная концентрация, собранные дни и лоу-фай.',
    exampleDay: '«Утренний свет и тихий фокус»',
    visualCue: 'Асимметричная сетка, много воздуха и аккуратные графические акценты.',
  },
  dreamy_aura: {
    bg: '#151221',
    accent: '#C99BFF',
    light: '#F3EBFF',
    when: 'Дождь, закаты, созерцательные и тихие вечера, эмбиент и неоклассика.',
    exampleDay: '«Вечерний дождь и мягкий свет»',
    visualCue: 'Плавающие световые ореолы в духе Клода Моне и мягкая дымка.',
  },
  kinetic_zine: {
    bg: '#141118',
    accent: '#D8FF4B',
    light: '#F4EFE6',
    when: 'Драйв, дедлайны, спорт, ночной город, электроника, хип-хоп и рок.',
    exampleDay: '«Ночь перед сдачей проекта»',
    visualCue: 'Диагональные векторы, контраст и геометрический ритм Кандинского.',
  },
};

export default function GuideScreen() {
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<ArtStyle>('analog_film');

  const modeMeta = ART_STYLE_META[activeMode];
  const sample = MODE_SAMPLES[activeMode];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={styles.backBtn}
          activeOpacity={0.75}
        >
          <Ionicons name="arrow-back" size={18} color={THEME.colors.text} />
          <Text style={styles.backText}>Назад</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Как устроен дневник</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Вступление */}
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Сохраняйте ощущение дня</Text>
          <Text style={styles.heroQuote}>
            Фотографии помнят, как выглядел день. KeepMemory сохраняет, как он ощущался — через слова, свет, последовательность кадров и музыку.
          </Text>
        </View>

        {/* Пошаговое управление */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Как вести дневник</Text>
          <View style={styles.stepsCol}>
            {STEPS.map((step) => (
              <View key={step.num} style={styles.stepBox}>
                <View style={styles.stepNumBadge}>
                  <Text style={styles.stepNumText}>{step.num}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Из чего строится воспоминание */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Что влияет на результат</Text>
          <View style={styles.factorsCard}>
            <View style={styles.factorRow}>
              <Ionicons name="document-text-outline" size={18} color={THEME.colors.accent} />
              <View style={styles.factorContent}>
                <Text style={styles.factorTitle}>Текст и профиль</Text>
                <Text style={styles.factorSub}>
                  Задают короткое название папки, интонацию типографики и персональную подачу под ваши интересы.
                </Text>
              </View>
            </View>

            <View style={styles.factorDivider} />

            <View style={styles.factorRow}>
              <Ionicons name="images-outline" size={18} color={THEME.colors.warmGold} />
              <View style={styles.factorContent}>
                <Text style={styles.factorTitle}>Фотографии и альбом</Text>
                <Text style={styles.factorSub}>
                  Определяют палитру из трёх оттенков, глубину теней и последовательность кадров.
                </Text>
              </View>
            </View>

            <View style={styles.factorDivider} />

            <View style={styles.factorRow}>
              <Ionicons name="musical-notes-outline" size={18} color={THEME.colors.cyanSignal} />
              <View style={styles.factorContent}>
                <Text style={styles.factorTitle}>Песня и её ритм</Text>
                <Text style={styles.factorSub}>
                  Управляет скоростью движения слоёв, темпом перелистывания альбома и эквалайзером.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Интерактивный разбор 4 режимов */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Художественные режимы</Text>
          <Text style={styles.sectionSub}>
            Все дни принадлежат одной визуальной системе, но их свет, фактура и композиция меняются под настроение:
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

          <View
            style={[
              styles.specimenCard,
              { backgroundColor: sample.bg, borderColor: sample.accent },
            ]}
          >
            <View style={styles.specimenHeader}>
              <View style={styles.specimenDotRow}>
                <View style={[styles.specimenDot, { backgroundColor: sample.accent }]} />
                <Text style={[styles.specimenMode, { color: sample.accent }]}>
                  {modeMeta.shortTitle}
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
              <Text style={styles.specimenLabel}>Ориентир</Text>
              <Text style={[styles.specimenText, { color: sample.light }]}>
                {modeMeta.reference}
              </Text>
            </View>

            <View style={styles.specimenBlock}>
              <Text style={styles.specimenLabel}>Когда включается</Text>
              <Text style={styles.specimenMuted}>{sample.when}</Text>
            </View>

            <View style={styles.specimenBlock}>
              <Text style={styles.specimenLabel}>Как выглядит кадр</Text>
              <Text style={styles.specimenMuted}>{sample.visualCue}</Text>
            </View>
          </View>
        </View>

        {/* Полезные жесты */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Удобные мелочи</Text>
          <View style={styles.controlsGrid}>
            <View style={styles.controlItem}>
              <Ionicons name="images-outline" size={18} color={THEME.colors.accent} />
              <Text style={styles.controlTitle}>Нажатие на фото</Text>
              <Text style={styles.controlSub}>Листает кадры альбома вручную</Text>
            </View>
            <View style={styles.controlItem}>
              <Ionicons name="musical-notes-outline" size={18} color={THEME.colors.warmGold} />
              <Text style={styles.controlTitle}>Музыка в записи</Text>
              <Text style={styles.controlSub}>Запускает ритм и смену кадров</Text>
            </View>
            <View style={styles.controlItem}>
              <Ionicons name="search-outline" size={18} color={THEME.colors.cyanSignal} />
              <Text style={styles.controlTitle}>Поиск и эмоции</Text>
              <Text style={styles.controlSub}>Быстрый поиск по архиву и неделям</Text>
            </View>
            <View style={styles.controlItem}>
              <Ionicons name="share-outline" size={18} color={THEME.colors.accent} />
              <Text style={styles.controlTitle}>Экспорт PNG</Text>
              <Text style={styles.controlSub}>Сохраняет открытку дня на телефон</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.ctaBtn}
          activeOpacity={0.85}
          onPress={() => router.replace('/(tabs)/create')}
        >
          <Text style={styles.ctaText}>Записать новый день</Text>
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
    fontSize: 15,
    fontWeight: '500',
    color: THEME.colors.text,
  },
  topTitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
  },
  scroll: {
    padding: THEME.spacing.md,
    gap: 24,
    paddingBottom: 48,
  },
  heroCard: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: 18,
    gap: 10,
  },
  heroTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 27,
    color: THEME.colors.text,
    lineHeight: 33,
  },
  heroQuote: {
    color: THEME.colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  section: { gap: 12 },
  sectionTitle: {
    fontFamily: THEME.fonts.serif,
    fontSize: 21,
    color: THEME.colors.text,
  },
  sectionSub: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  stepsCol: { gap: 10 },
  stepBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: 14,
  },
  stepNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 99,
    backgroundColor: THEME.colors.accentSoft,
    borderWidth: 1,
    borderColor: THEME.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.accent,
  },
  stepContent: { flex: 1, gap: 4 },
  stepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  stepBody: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  factorsCard: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    padding: 16,
    gap: 14,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  factorContent: { flex: 1, gap: 3 },
  factorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  factorSub: {
    color: THEME.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  factorDivider: {
    height: 1,
    backgroundColor: THEME.colors.border,
  },
  modeTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeTab: {
    width: '48.5%',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
  },
  modeTabActive: {
    borderColor: THEME.colors.accent,
    backgroundColor: THEME.colors.accentSoft,
  },
  modeTabTitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    fontWeight: '500',
  },
  modeTabTitleActive: {
    color: THEME.colors.accent,
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
  specimenMode: {
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(244, 239, 230, 0.55)',
  },
  specimenText: {
    fontSize: 13,
    lineHeight: 19,
  },
  specimenMuted: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(244, 239, 230, 0.76)',
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
    padding: 14,
    gap: 5,
  },
  controlTitle: {
    fontSize: 13,
    color: THEME.colors.text,
    fontWeight: '600',
    marginTop: 2,
  },
  controlSub: {
    fontSize: 12,
    lineHeight: 17,
    color: THEME.colors.textMuted,
  },
  ctaBtn: {
    backgroundColor: THEME.colors.accent,
    paddingVertical: 15,
    borderRadius: THEME.radius.pill,
    alignItems: 'center',
  },
  ctaText: {
    color: THEME.colors.accentText,
    fontSize: 15,
    fontWeight: '700',
  },
});