import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import {
  Canvas,
  Image as SkiaImage,
  Rect,
  LinearGradient,
  RadialGradient,
  Circle,
  Line,
  vec,
  useImage,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import {
  formatMemoryDate,
  getMemoryPhotos,
  MemoryDay,
} from '../types/memory';
import { ART_STYLE_META } from '../constants/artStyles';
import { analyzeDayAtmosphere } from '../services/atmosphereInterpreter';
import { THEME } from '../constants/theme';

interface MemoryCanvasProps {
  memory: MemoryDay;
  isPlaying?: boolean;
  activePhotoIndex?: number;
  onSelectPhoto?: (index: number) => void;
}

type LoadedSkImage = ReturnType<typeof useImage>;

function formatSentenceCase(value: string): string {
  const clean = value.trim().toLowerCase();
  if (!clean) return '';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function buildGrainDots(seedKey: string, width: number, height: number, count: number) {
  let seed = 0;
  for (let i = 0; i < seedKey.length; i++) {
    seed = (seed * 31 + seedKey.charCodeAt(i)) % 233280;
  }
  const nextRand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  return Array.from({ length: count }, (_, idx) => ({
    id: idx,
    x: nextRand() * width,
    y: nextRand() * height,
    size: nextRand() > 0.72 ? 2 : 1.1,
    light: nextRand() > 0.45,
  }));
}

export function MemoryCanvas({
  memory,
  isPlaying = false,
  activePhotoIndex,
  onSelectPhoto,
}: MemoryCanvasProps) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth - 32, 420);
  const innerWidth = cardWidth - 2;
  const photoHeight = Math.round(cardWidth * 1.18);

  const photos = useMemo(() => getMemoryPhotos(memory), [memory]);
  const [internalIndex, setInternalIndex] = useState(0);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Держим предыдущий кадр под новым для плавного кроссфейда без чёрной вспышки
  const [imgPair, setImgPair] = useState<{
    prev: LoadedSkImage;
    curr: LoadedSkImage;
  }>({ prev: null, curr: null });
  const fadeIn = useSharedValue(1);

  useEffect(() => {
    setInternalIndex(0);
    setImgPair({ prev: null, curr: null });
  }, [memory.id]);

  const photoCount = photos.length;
  const currentIndex =
    photoCount > 0 ? (activePhotoIndex ?? internalIndex) % photoCount : 0;

  const activeUri = photos[currentIndex] ?? memory.photoUri;
  const safeUri = /^blob:/i.test(activeUri) ? null : activeUri;
  const loadedImage = useImage(safeUri);

  useEffect(() => {
    if (!safeUri) {
      setImgPair({ prev: null, curr: null });
      return;
    }
    if (!loadedImage) return;
    setImgPair((state) => {
      if (state.curr === loadedImage) return state;
      return { prev: state.curr, curr: loadedImage };
    });
    fadeIn.value = 0;
    fadeIn.value = withTiming(1, {
      duration: isPlayingRef.current ? 520 : 680,
      easing: Easing.out(Easing.cubic),
    });
  }, [loadedImage, safeUri, fadeIn]);

  const { style, track } = memory;
  const [
    bgCol = THEME.colors.bg,
    accentCol = THEME.colors.accent,
    lightCol = THEME.colors.text,
  ] = style.palette ?? [];
  const energy = Math.min(1, Math.max(0.15, track.energy ?? 0.5));
  const modeMeta = ART_STYLE_META[style.artStyle] ?? ART_STYLE_META.analog_film;
  const atmosphere = useMemo(() => analyzeDayAtmosphere(memory), [memory]);

  const selectIndex = (nextIndex: number) => {
    if (photoCount <= 1) return;
    const normalized = ((nextIndex % photoCount) + photoCount) % photoCount;
    if (onSelectPhoto) {
      onSelectPhoto(normalized);
    } else {
      setInternalIndex(normalized);
    }
  };

  // При включённой музыке кадры альбома автоматически сменяются в темпе трека
  useEffect(() => {
    if (!isPlaying || photoCount <= 1) return;
    const speed = Math.max(0.45, style.motionSpeed || 1);
    const intervalMs = Math.max(1900, Math.round(4400 / speed));

    const timer = setInterval(() => {
      selectIndex(currentIndex + 1);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, photoCount, currentIndex, style.motionSpeed]);

  // pulse — основной цикл движения; activity — усиление при включённой музыке
  const pulse = useSharedValue(0);
  const activity = useSharedValue(isPlaying ? 1 : 0.35);

  useEffect(() => {
    const speed = Math.max(0.25, style.motionSpeed || 1);
    const activeDuration = Math.max(520, Math.round(2300 / speed));
    const idleDuration = Math.max(2600, Math.round(5200 / speed));

    cancelAnimation(pulse);
    pulse.value = withRepeat(
      withTiming(1, {
        duration: isPlaying ? activeDuration : idleDuration,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    activity.value = withTiming(isPlaying ? 1 : 0.35, { duration: 420 });

    return () => {
      cancelAnimation(pulse);
    };
  }, [style.motionSpeed, isPlaying, pulse, activity]);

  // Аналоговая плёнка — двойная засветка
  const leakCenter = useDerivedValue(() =>
    vec(
      innerWidth * (0.12 + pulse.value * (0.55 + activity.value * 0.2)),
      photoHeight * (0.12 + pulse.value * 0.26)
    )
  );
  const leakRadius = useDerivedValue(
    () => innerWidth * (0.46 + pulse.value * 0.18 * activity.value)
  );
  const warmCornerCenter = useDerivedValue(() =>
    vec(innerWidth * (0.88 - pulse.value * 0.16), photoHeight * (0.86 - pulse.value * 0.1))
  );

  // Кольца ритма
  const ringRadius = useDerivedValue(() => 12 + pulse.value * (10 + energy * 14) * activity.value);
  const ringOuterRadius = useDerivedValue(
    () => 22 + pulse.value * (16 + energy * 18) * activity.value
  );

  // Свет и аура — 3 плавающих импрессионистских световых ореола
  const aura1Center = useDerivedValue(() =>
    vec(innerWidth * (0.22 + pulse.value * 0.54), photoHeight * (0.24 + pulse.value * 0.12))
  );
  const aura2Center = useDerivedValue(() =>
    vec(innerWidth * (0.8 - pulse.value * 0.5), photoHeight * (0.68 - pulse.value * 0.16))
  );
  const aura3Center = useDerivedValue(() =>
    vec(innerWidth * (0.48 + (0.5 - pulse.value) * 0.32), photoHeight * (0.46 + pulse.value * 0.14))
  );
  const auraRadius = useDerivedValue(() => innerWidth * (0.52 + pulse.value * 0.18));

  // Кинетика и ритм — диагональные векторы Кандинского
  const beamP1 = useDerivedValue(() =>
    vec(-20, photoHeight * (0.2 + pulse.value * 0.32 * activity.value))
  );
  const beamP2 = useDerivedValue(() =>
    vec(innerWidth + 20, photoHeight * (0.04 + pulse.value * 0.22 * activity.value))
  );
  const beam2P1 = useDerivedValue(() =>
    vec(-20, photoHeight * (0.76 - pulse.value * 0.24 * activity.value))
  );
  const beam2P2 = useDerivedValue(() =>
    vec(innerWidth + 20, photoHeight * (0.56 - pulse.value * 0.16 * activity.value))
  );
  const kineticDotX = useDerivedValue(() => innerWidth * (0.2 + pulse.value * 0.6));

  // Полоса музыкального ритма + 5 столбиков эквалайзера
  const barBaseY = photoHeight - 16;
  const rhythmBarWidth = useDerivedValue(
    () => (innerWidth - 88) * (0.18 + pulse.value * (0.45 + energy * 0.37) * activity.value)
  );
  const eqH1 = useDerivedValue(() => 4 + (0.3 + pulse.value * 0.7) * (8 + energy * 12) * activity.value);
  const eqH2 = useDerivedValue(() => 5 + (1 - Math.abs(pulse.value - 0.5) * 2) * (10 + energy * 16) * activity.value);
  const eqH3 = useDerivedValue(() => 4 + (1 - pulse.value * 0.75) * (9 + energy * 15) * activity.value);
  const eqH4 = useDerivedValue(() => 5 + (0.25 + pulse.value * 0.75) * (10 + energy * 14) * activity.value);
  const eqH5 = useDerivedValue(() => 3 + (1 - pulse.value * 0.6) * (7 + energy * 10) * activity.value);

  const eqY1 = useDerivedValue(() => barBaseY - eqH1.value);
  const eqY2 = useDerivedValue(() => barBaseY - eqH2.value);
  const eqY3 = useDerivedValue(() => barBaseY - eqH3.value);
  const eqY4 = useDerivedValue(() => barBaseY - eqH4.value);
  const eqY5 = useDerivedValue(() => barBaseY - eqH5.value);

  const grainCount = Math.round((style.grainIntensity ?? 0.35) * 190);
  const grainDots = useMemo(
    () => buildGrainDots(`${memory.id}-${currentIndex}`, innerWidth, photoHeight, grainCount),
    [memory.id, currentIndex, innerWidth, photoHeight, grainCount]
  );

  const isSerif = style.typographyVariant === 'serif_editorial';
  const eqStartX = innerWidth - 52;

  return (
    <View
      style={[
        styles.frame,
        {
          width: cardWidth,
          backgroundColor: bgCol,
          borderColor: 'rgba(255,255,255,0.14)',
        },
      ]}
    >
      {/* Верхняя подпись карточки */}
      <View style={styles.metaBar}>
        <View style={styles.metaLeft}>
          <View
            style={[
              styles.liveDot,
              { backgroundColor: accentCol, opacity: isPlaying ? 1 : 0.65 },
            ]}
          />
          <Text style={[styles.metaDate, { color: lightCol }]}>
            {formatMemoryDate(memory.date)}
          </Text>
        </View>
        <Text style={[styles.metaStyle, { color: accentCol }]}>
          {modeMeta.shortTitle}
        </Text>
      </View>

      {/* Полотно Skia — нажатие листает альбом */}
      <Pressable
        onPress={() => selectIndex(currentIndex + 1)}
        disabled={photoCount <= 1}
        style={{ width: innerWidth, height: photoHeight, overflow: 'hidden' }}
      >
        <Canvas style={{ width: innerWidth, height: photoHeight }}>
          <Rect x={0} y={0} width={innerWidth} height={photoHeight} color={bgCol} />

          {imgPair.prev && (
            <SkiaImage
              image={imgPair.prev}
              x={0}
              y={0}
              width={innerWidth}
              height={photoHeight}
              fit="cover"
            />
          )}

          {imgPair.curr && (
            <SkiaImage
              image={imgPair.curr}
              x={0}
              y={0}
              width={innerWidth}
              height={photoHeight}
              fit="cover"
              opacity={fadeIn}
            />
          )}

          {/* Атмосферная цветовая тонировка дня */}
          <Rect
            x={0}
            y={0}
            width={innerWidth}
            height={photoHeight}
            opacity={style.artStyle === 'kinetic_zine' ? 0.34 : 0.24}
          >
            <LinearGradient
              start={vec(0, 0)}
              end={vec(innerWidth, photoHeight)}
              colors={[bgCol, accentCol]}
            />
          </Rect>

          {/* Верхняя и нижняя виньетка глубины */}
          <Rect x={0} y={0} width={innerWidth} height={photoHeight * 0.26} opacity={0.55}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, photoHeight * 0.26)}
              colors={[bgCol, 'transparent']}
            />
          </Rect>
          <Rect x={0} y={photoHeight * 0.54} width={innerWidth} height={photoHeight * 0.46}>
            <LinearGradient
              start={vec(0, photoHeight * 0.54)}
              end={vec(0, photoHeight)}
              colors={['transparent', bgCol]}
            />
          </Rect>

          {/* Аналоговая плёнка */}
          {style.artStyle === 'analog_film' && (
            <>
              <Rect x={0} y={0} width={innerWidth} height={photoHeight} opacity={0.46}>
                <RadialGradient
                  c={leakCenter}
                  r={leakRadius}
                  colors={[accentCol, 'transparent']}
                />
              </Rect>
              <Rect x={0} y={0} width={innerWidth} height={photoHeight} opacity={0.22}>
                <RadialGradient
                  c={warmCornerCenter}
                  r={innerWidth * 0.48}
                  colors={[lightCol, 'transparent']}
                />
              </Rect>
              <Rect
                x={12}
                y={12}
                width={innerWidth - 24}
                height={photoHeight - 24}
                color={lightCol}
                style="stroke"
                strokeWidth={0.75}
                opacity={0.32}
              />
              <Line p1={vec(20, 20)} p2={vec(36, 20)} color={lightCol} strokeWidth={1.4} opacity={0.75} />
              <Line p1={vec(20, 20)} p2={vec(20, 36)} color={lightCol} strokeWidth={1.4} opacity={0.75} />
              <Line p1={vec(innerWidth - 20, 20)} p2={vec(innerWidth - 36, 20)} color={lightCol} strokeWidth={1.4} opacity={0.75} />
              <Line p1={vec(innerWidth - 20, 20)} p2={vec(innerWidth - 20, 36)} color={lightCol} strokeWidth={1.4} opacity={0.75} />
              <Line p1={vec(20, photoHeight - 30)} p2={vec(36, photoHeight - 30)} color={lightCol} strokeWidth={1.4} opacity={0.6} />
              <Line p1={vec(20, photoHeight - 30)} p2={vec(20, photoHeight - 46)} color={lightCol} strokeWidth={1.4} opacity={0.6} />
            </>
          )}

          {/* Выставочная сетка */}
          {style.artStyle === 'minimal_editorial' && (
            <>
              <Line
                p1={vec(18, photoHeight * 0.33)}
                p2={vec(innerWidth - 18, photoHeight * 0.33)}
                color={lightCol}
                strokeWidth={0.7}
                opacity={0.3}
              />
              <Line
                p1={vec(18, photoHeight * 0.66)}
                p2={vec(innerWidth - 18, photoHeight * 0.66)}
                color={lightCol}
                strokeWidth={0.7}
                opacity={0.22}
              />
              <Line
                p1={vec(innerWidth * 0.68, 18)}
                p2={vec(innerWidth * 0.68, photoHeight - 32)}
                color={lightCol}
                strokeWidth={0.7}
                opacity={0.32}
              />
              <Line
                p1={vec(innerWidth * 0.68 - 7, photoHeight * 0.33)}
                p2={vec(innerWidth * 0.68 + 7, photoHeight * 0.33)}
                color={accentCol}
                strokeWidth={1.2}
                opacity={0.9}
              />
              <Line
                p1={vec(innerWidth * 0.68, photoHeight * 0.33 - 7)}
                p2={vec(innerWidth * 0.68, photoHeight * 0.33 + 7)}
                color={accentCol}
                strokeWidth={1.2}
                opacity={0.9}
              />
              <Circle
                cx={innerWidth - 40}
                cy={40}
                r={ringOuterRadius}
                color={accentCol}
                style="stroke"
                strokeWidth={0.8}
                opacity={0.35}
              />
              <Circle
                cx={innerWidth - 40}
                cy={40}
                r={ringRadius}
                color={accentCol}
                style="stroke"
                strokeWidth={1.4}
                opacity={0.9}
              />
              <Circle cx={innerWidth - 40} cy={40} r={3.5} color={accentCol} />
            </>
          )}

          {/* Свет и аура */}
          {style.artStyle === 'dreamy_aura' && (
            <>
              <Rect x={0} y={0} width={innerWidth} height={photoHeight} opacity={0.44}>
                <RadialGradient
                  c={aura1Center}
                  r={auraRadius}
                  colors={[accentCol, 'transparent']}
                />
              </Rect>
              <Rect x={0} y={0} width={innerWidth} height={photoHeight} opacity={0.3}>
                <RadialGradient
                  c={aura2Center}
                  r={auraRadius}
                  colors={[lightCol, 'transparent']}
                />
              </Rect>
              <Rect x={0} y={0} width={innerWidth} height={photoHeight} opacity={0.22}>
                <RadialGradient
                  c={aura3Center}
                  r={innerWidth * 0.4}
                  colors={[accentCol, 'transparent']}
                />
              </Rect>
              <Circle
                cx={innerWidth * 0.5}
                cy={photoHeight * 0.48}
                r={innerWidth * 0.39}
                color={lightCol}
                style="stroke"
                strokeWidth={0.65}
                opacity={0.24}
              />
              <Circle
                cx={innerWidth * 0.5}
                cy={photoHeight * 0.48}
                r={innerWidth * 0.28}
                color={accentCol}
                style="stroke"
                strokeWidth={0.65}
                opacity={0.22}
              />
            </>
          )}

          {/* Кинетика и ритм */}
          {style.artStyle === 'kinetic_zine' && (
            <>
              <Line p1={beamP1} p2={beamP2} color={accentCol} strokeWidth={2.2} opacity={0.82} />
              <Line p1={beam2P1} p2={beam2P2} color={lightCol} strokeWidth={1.1} opacity={0.5} />
              <Line
                p1={vec(innerWidth * 0.14, 18)}
                p2={vec(innerWidth * 0.86, photoHeight - 36)}
                color={lightCol}
                strokeWidth={0.65}
                opacity={0.26}
              />
              <Circle
                cx={36}
                cy={36}
                r={ringRadius}
                color={accentCol}
                style="stroke"
                strokeWidth={1.6}
                opacity={0.92}
              />
              <Circle cx={kineticDotX} cy={photoHeight * 0.26} r={5} color={accentCol} opacity={0.9} />
              <Rect
                x={innerWidth - 48}
                y={22}
                width={26}
                height={26}
                color={accentCol}
                style="stroke"
                strokeWidth={1.3}
                opacity={0.85}
              />
              <Rect
                x={innerWidth - 41}
                y={29}
                width={12}
                height={12}
                color={lightCol}
                opacity={0.55}
              />
            </>
          )}

          {/* Процедурное зерно */}
          {grainDots.map((dot) => (
            <Rect
              key={dot.id}
              x={dot.x}
              y={dot.y}
              width={dot.size}
              height={dot.size}
              color={dot.light ? lightCol : '#000000'}
              opacity={(style.grainIntensity ?? 0.35) * 0.34}
            />
          ))}

          {/* Полоса музыкального ритма + 5-полосный живой эквалайзер */}
          <Rect
            x={18}
            y={barBaseY}
            width={innerWidth - 88}
            height={2}
            color={lightCol}
            opacity={0.18}
          />
          <Rect
            x={18}
            y={barBaseY}
            width={rhythmBarWidth}
            height={2}
            color={accentCol}
            opacity={0.95}
          />

          <Rect x={eqStartX} y={eqY1} width={3} height={eqH1} color={accentCol} opacity={0.88} />
          <Rect x={eqStartX + 7} y={eqY2} width={3} height={eqH2} color={accentCol} opacity={0.95} />
          <Rect x={eqStartX + 14} y={eqY3} width={3} height={eqH3} color={lightCol} opacity={0.9} />
          <Rect x={eqStartX + 21} y={eqY4} width={3} height={eqH4} color={accentCol} opacity={0.95} />
          <Rect x={eqStartX + 28} y={eqY5} width={3} height={eqH5} color={accentCol} opacity={0.82} />
        </Canvas>

        {/* Индикатор альбома поверх кадра */}
        {photoCount > 1 ? (
          <View pointerEvents="none" style={styles.albumOverlayTop}>
            <View style={styles.segmentsRow}>
              {photos.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.segmentTrack,
                    idx === currentIndex && { backgroundColor: accentCol },
                  ]}
                />
              ))}
            </View>
            <View style={styles.frameTag}>
              <Text style={[styles.frameTagText, { color: lightCol }]}>
                {currentIndex + 1} / {photoCount}
              </Text>
            </View>
          </View>
        ) : null}
      </Pressable>

      {/* Подпись карточки */}
      <View style={styles.footer}>
        <View style={styles.moodRow}>
          <View style={[styles.moodPill, { borderColor: accentCol }]}>
            <Text style={[styles.moodPillText, { color: accentCol }]}>
              {formatSentenceCase(atmosphere.moodBadge)}
            </Text>
          </View>
          {photoCount > 1 ? (
            <Text style={styles.albumHint}>
              {isPlaying ? 'Смена в ритме песни' : 'Нажмите на фото'}
            </Text>
          ) : null}
        </View>

        <Text
          style={[
            styles.folderTitle,
            { color: lightCol },
            isSerif ? styles.serifTitle : styles.monoTitle,
          ]}
        >
          {memory.folderTitle}
        </Text>

        <Text style={styles.atmosphereNote}>{atmosphere.cardCaption}</Text>

        <View style={styles.bottomRow}>
          <Text style={[styles.trackLabel, { color: accentCol }]} numberOfLines={1}>
            ♫ {track.artist} — {track.title}
          </Text>

          <View style={styles.swatches}>
            {(style.palette ?? []).map((hex, i) => (
              <View
                key={`${hex}-${i}`}
                style={[styles.swatch, { backgroundColor: hex }]}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderRadius: THEME.radius.md,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  metaBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
  },
  metaDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  metaStyle: {
    fontSize: 12,
    fontWeight: '600',
  },
  albumOverlayTop: {
    position: 'absolute',
    top: 10,
    left: 14,
    right: 14,
    gap: 8,
  },
  segmentsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  segmentTrack: {
    flex: 1,
    height: 2.5,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  frameTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(6, 6, 9, 0.68)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: THEME.radius.pill,
  },
  frameTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    padding: 18,
    gap: 9,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  moodPill: {
    borderWidth: 1,
    borderRadius: THEME.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(6, 6, 9, 0.3)',
  },
  moodPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  albumHint: {
    fontSize: 11,
    color: 'rgba(244, 239, 230, 0.55)',
  },
  folderTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  serifTitle: {
    fontFamily: THEME.fonts.serif,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  monoTitle: {
    fontFamily: THEME.fonts.mono,
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 25,
    letterSpacing: 0.3,
  },
  atmosphereNote: {
    color: 'rgba(244, 239, 230, 0.74)',
    fontSize: 13,
    lineHeight: 19,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  trackLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  swatches: {
    flexDirection: 'row',
    gap: 5,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
});