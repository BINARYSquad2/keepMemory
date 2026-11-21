import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
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
  Easing,
} from 'react-native-reanimated';
import { ArtStyle, formatMemoryDate, MemoryDay } from '../types/memory';
import { THEME } from '../constants/theme';

interface MemoryCanvasProps {
  memory: MemoryDay;
  isPlaying?: boolean;
}

const MODE_LABELS: Record<ArtStyle, string> = {
  analog_film: '01 // ANALOG FILM',
  minimal_editorial: '02 // EDITORIAL GRID',
  dreamy_aura: '03 // ETHEREAL AURA',
  kinetic_zine: '04 // KINETIC ZINE',
};

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

export function MemoryCanvas({ memory, isPlaying = true }: MemoryCanvasProps) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth - 32, 420);
  const innerWidth = cardWidth - 2;
  const photoHeight = Math.round(cardWidth * 1.18);

  const image = useImage(memory.photoUri);
  const { style, track } = memory;
  const [bgCol, accentCol, lightCol] = style.palette;

  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!isPlaying) return;
    const speed = Math.max(0.25, style.motionSpeed);
    const duration = Math.max(650, Math.round(3000 / speed));

    pulse.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [style.motionSpeed, isPlaying]);

  // Живые координаты для каждого художественного режима
  const leakCenter = useDerivedValue(() =>
    vec(
      innerWidth * (0.15 + pulse.value * 0.7),
      photoHeight * (0.14 + pulse.value * 0.28)
    )
  );
  const leakRadius = useDerivedValue(() => innerWidth * (0.5 + pulse.value * 0.22));

  const auraTopCenter = useDerivedValue(() =>
    vec(
      innerWidth * (0.25 + pulse.value * 0.5),
      photoHeight * (0.28 - pulse.value * 0.1)
    )
  );
  const auraBottomCenter = useDerivedValue(() =>
    vec(
      innerWidth * (0.78 - pulse.value * 0.48),
      photoHeight * (0.72 + pulse.value * 0.08)
    )
  );
  const auraRadius = useDerivedValue(() => innerWidth * (0.58 + pulse.value * 0.16));

  const ringRadius = useDerivedValue(() => 14 + pulse.value * 16);
  const ringOuterRadius = useDerivedValue(() => 24 + pulse.value * 24);

  const beamP1 = useDerivedValue(() => vec(-20, photoHeight * (0.18 + pulse.value * 0.35)));
  const beamP2 = useDerivedValue(() =>
    vec(innerWidth + 20, photoHeight * (0.04 + pulse.value * 0.2))
  );
  const beam2P1 = useDerivedValue(() => vec(-20, photoHeight * (0.75 - pulse.value * 0.25)));
  const beam2P2 = useDerivedValue(() =>
    vec(innerWidth + 20, photoHeight * (0.55 - pulse.value * 0.15))
  );

  const rhythmBarWidth = useDerivedValue(
    () => (innerWidth - 36) * (0.18 + pulse.value * 0.82)
  );

  const grainCount = Math.round(style.grainIntensity * 190);
  const grainDots = useMemo(
    () => buildGrainDots(memory.id, innerWidth, photoHeight, grainCount),
    [memory.id, innerWidth, photoHeight, grainCount]
  );

  const isSerif = style.typographyVariant === 'serif_editorial';

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
      {/* Единый выставочный заголовок страницы */}
      <View style={styles.metaBar}>
        <View style={styles.metaLeft}>
          <View style={[styles.liveDot, { backgroundColor: accentCol }]} />
          <Text style={[styles.metaMono, { color: lightCol }]}>
            {formatMemoryDate(memory.date).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.metaMono, { color: accentCol }]}>
          {MODE_LABELS[style.artStyle]}
        </Text>
      </View>

      {/* Полотно Skia */}
      <View style={{ width: innerWidth, height: photoHeight, overflow: 'hidden' }}>
        <Canvas style={{ width: innerWidth, height: photoHeight }}>
          {/* Базовый цвет */}
          <Rect x={0} y={0} width={innerWidth} height={photoHeight} color={bgCol} />

          {/* Реальная фотография */}
          {image && (
            <SkiaImage
              image={image}
              x={0}
              y={0}
              width={innerWidth}
              height={photoHeight}
              fit="cover"
            />
          )}

          {/* Атмосферная тонировка из палитры дня */}
          <Rect
            x={0}
            y={0}
            width={innerWidth}
            height={photoHeight}
            opacity={style.artStyle === 'kinetic_zine' ? 0.36 : 0.25}
          >
            <LinearGradient
              start={vec(0, 0)}
              end={vec(innerWidth, photoHeight)}
              colors={[bgCol, accentCol]}
            />
          </Rect>

          {/* Мягкое верхнее и нижнее затемнение (глубина + читаемость) */}
          <Rect x={0} y={0} width={innerWidth} height={photoHeight * 0.26} opacity={0.55}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, photoHeight * 0.26)}
              colors={[bgCol, 'transparent']}
            />
          </Rect>
          <Rect
            x={0}
            y={photoHeight * 0.52}
            width={innerWidth}
            height={photoHeight * 0.48}
          >
            <LinearGradient
              start={vec(0, photoHeight * 0.52)}
              end={vec(0, photoHeight)}
              colors={['transparent', bgCol]}
            />
          </Rect>

          {/* РЕЖИМ 1: ANALOG FILM — живая засветка + плёночная рамка */}
          {style.artStyle === 'analog_film' && (
            <>
              <Rect x={0} y={0} width={innerWidth} height={photoHeight} opacity={0.48}>
                <RadialGradient
                  c={leakCenter}
                  r={leakRadius}
                  colors={[accentCol, 'transparent']}
                />
              </Rect>
              <Rect
                x={12}
                y={12}
                width={innerWidth - 24}
                height={photoHeight - 24}
                color={lightCol}
                style="stroke"
                strokeWidth={0.8}
                opacity={0.35}
              />
            </>
          )}

          {/* РЕЖИМ 2: MINIMAL EDITORIAL — тонкая швейцарская сетка + пульс */}
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
                p2={vec(innerWidth * 0.68, photoHeight - 18)}
                color={lightCol}
                strokeWidth={0.7}
                opacity={0.3}
              />
              <Circle
                cx={innerWidth - 38}
                cy={38}
                r={ringOuterRadius}
                color={accentCol}
                style="stroke"
                strokeWidth={0.8}
                opacity={0.35}
              />
              <Circle
                cx={innerWidth - 38}
                cy={38}
                r={ringRadius}
                color={accentCol}
                style="stroke"
                strokeWidth={1.4}
                opacity={0.9}
              />
              <Circle cx={innerWidth - 38} cy={38} r={3.5} color={accentCol} />
            </>
          )}

          {/* РЕЖИМ 3: DREAMY AURA — два плавающих световых ореола */}
          {style.artStyle === 'dreamy_aura' && (
            <>
              <Rect x={0} y={0} width={innerWidth} height={photoHeight} opacity={0.44}>
                <RadialGradient
                  c={auraTopCenter}
                  r={auraRadius}
                  colors={[accentCol, 'transparent']}
                />
              </Rect>
              <Rect x={0} y={0} width={innerWidth} height={photoHeight} opacity={0.32}>
                <RadialGradient
                  c={auraBottomCenter}
                  r={auraRadius}
                  colors={[lightCol, 'transparent']}
                />
              </Rect>
              <Circle
                cx={innerWidth * 0.5}
                cy={photoHeight * 0.5}
                r={innerWidth * 0.42}
                color={lightCol}
                style="stroke"
                strokeWidth={0.6}
                opacity={0.22}
              />
            </>
          )}

          {/* РЕЖИМ 4: KINETIC ZINE — динамичные лучи ритма + угловые маркеры */}
          {style.artStyle === 'kinetic_zine' && (
            <>
              <Line
                p1={beamP1}
                p2={beamP2}
                color={accentCol}
                strokeWidth={2}
                opacity={0.75}
              />
              <Line
                p1={beam2P1}
                p2={beam2P2}
                color={lightCol}
                strokeWidth={1}
                opacity={0.45}
              />
              <Circle
                cx={34}
                cy={34}
                r={ringRadius}
                color={accentCol}
                style="stroke"
                strokeWidth={1.6}
                opacity={0.9}
              />
              <Rect
                x={innerWidth - 46}
                y={22}
                width={24}
                height={24}
                color={accentCol}
                style="stroke"
                strokeWidth={1.2}
                opacity={0.8}
              />
            </>
          )}

          {/* Процедурное зерно плёнки */}
          {grainDots.map((dot) => (
            <Rect
              key={dot.id}
              x={dot.x}
              y={dot.y}
              width={dot.size}
              height={dot.size}
              color={dot.light ? lightCol : '#000000'}
              opacity={style.grainIntensity * 0.34}
            />
          ))}

          {/* Линия музыкального ритма внизу полотна */}
          <Rect
            x={18}
            y={photoHeight - 14}
            width={innerWidth - 36}
            height={2}
            color={lightCol}
            opacity={0.18}
          />
          <Rect
            x={18}
            y={photoHeight - 14}
            width={rhythmBarWidth}
            height={2}
            color={accentCol}
            opacity={0.95}
          />
        </Canvas>
      </View>

      {/* Нижняя типографическая подпись экспоната */}
      <View style={styles.footer}>
        <Text
          style={[
            styles.folderTitle,
            { color: lightCol },
            isSerif ? styles.serifTitle : styles.monoTitle,
          ]}
        >
          {memory.folderTitle}
        </Text>

        {style.atmosphereNote ? (
          <Text style={styles.atmosphereNote}>{style.atmosphereNote}</Text>
        ) : null}

        <View style={styles.bottomRow}>
          <Text style={[styles.trackLabel, { color: accentCol }]} numberOfLines={1}>
            ♫ {track.artist} — {track.title}
          </Text>

          <View style={styles.swatches}>
            {style.palette.map((hex, i) => (
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
  metaMono: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.1,
  },
  footer: {
    padding: 18,
    gap: 10,
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
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  atmosphereNote: {
    color: 'rgba(244, 239, 230, 0.65)',
    fontSize: 12,
    lineHeight: 18,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  trackLabel: {
    flex: 1,
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
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