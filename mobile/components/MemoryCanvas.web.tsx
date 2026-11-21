import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { formatMemoryDate, MemoryDay } from '../types/memory';
import { ART_STYLE_META } from '../constants/artStyles';
import { THEME } from '../constants/theme';

interface MemoryCanvasProps {
  memory: MemoryDay;
  isPlaying?: boolean;
}

const absoluteFillStyle = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

export function MemoryCanvas({ memory, isPlaying = false }: MemoryCanvasProps) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth - 32, 420);
  const photoHeight = Math.round(cardWidth * 1.18);
  const { style, track } = memory;
  const [bgCol, accentCol, lightCol] = style.palette;
  const modeMeta = ART_STYLE_META[style.artStyle];
  const photoUri = /^(https?:|data:image\/|blob:)/i.test(memory.photoUri)
    ? memory.photoUri
    : null;
  const isSerif = style.typographyVariant === 'serif_editorial';

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const speed = Math.max(0.25, style.motionSpeed);
    const duration = isPlaying
      ? Math.max(520, Math.round(2300 / speed))
      : Math.max(2600, Math.round(5200 / speed));

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [style.motionSpeed, isPlaying, pulse]);

  const auraOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [isPlaying ? 0.22 : 0.14, isPlaying ? 0.45 : 0.26],
  });

  const barWidth = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: ['22%', `${Math.min(100, Math.max(40, (track.energy ?? 0.5) * 100))}%`],
  });

  return (
    <View
      style={[
        styles.frame,
        { width: cardWidth, backgroundColor: bgCol, borderColor: 'rgba(255,255,255,0.14)' },
      ]}
    >
      <View style={styles.metaBar}>
        <View style={styles.metaLeft}>
          <View
            style={[
              styles.liveDot,
              { backgroundColor: accentCol, opacity: isPlaying ? 1 : 0.6 },
            ]}
          />
          <Text style={[styles.metaMono, { color: lightCol }]}>
            {formatMemoryDate(memory.date).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.metaMono, { color: accentCol }]}>
          {modeMeta.canvasLabel}
        </Text>
      </View>

      <View
        style={[
          styles.artwork,
          { width: cardWidth - 2, height: photoHeight, backgroundColor: bgCol },
        ]}
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} resizeMode="cover" style={absoluteFillStyle} />
        ) : null}
        <View
          pointerEvents="none"
          style={[styles.colorWash, { backgroundColor: accentCol, opacity: 0.18 }]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.aura,
            styles.auraTop,
            { backgroundColor: accentCol, opacity: auraOpacity },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.aura,
            styles.auraBottom,
            { backgroundColor: lightCol, opacity: style.artStyle === 'dreamy_aura' ? 0.22 : 0.12 },
          ]}
        />
        {style.artStyle === 'analog_film' ? (
          <View pointerEvents="none" style={[styles.filmFrame, { borderColor: lightCol }]} />
        ) : null}
        {style.artStyle === 'minimal_editorial' ? (
          <View pointerEvents="none" style={styles.editorialGrid}>
            <View style={styles.gridLine} />
            <View style={styles.gridLine} />
            <View style={[styles.gridVertical, { borderColor: lightCol }]} />
          </View>
        ) : null}
        {style.artStyle === 'dreamy_aura' ? (
          <View pointerEvents="none" style={[styles.auraRing, { borderColor: lightCol }]} />
        ) : null}
        {style.artStyle === 'kinetic_zine' ? (
          <>
            <View pointerEvents="none" style={[styles.zineLine, { backgroundColor: accentCol }]} />
            <View pointerEvents="none" style={[styles.zineSquare, { borderColor: accentCol }]} />
          </>
        ) : null}

        <View style={styles.rhythmTrack}>
          <Animated.View
            style={[
              styles.rhythmBar,
              { width: barWidth, backgroundColor: accentCol },
            ]}
          />
        </View>
      </View>

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
            {style.palette.map((color, index) => (
              <View
                key={`${color}-${index}`}
                style={[styles.swatch, { backgroundColor: color }]}
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
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 99 },
  metaMono: {
    fontFamily: THEME.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.1,
  },
  artwork: { overflow: 'hidden', alignSelf: 'center' },
  colorWash: absoluteFillStyle,
  aura: { position: 'absolute', width: '80%', aspectRatio: 1, borderRadius: 999 },
  auraTop: { top: '-30%', left: '-18%' },
  auraBottom: { bottom: '-38%', right: '-20%' },
  filmFrame: {
    ...absoluteFillStyle,
    borderWidth: StyleSheet.hairlineWidth,
    margin: 12,
  },
  editorialGrid: {
    ...absoluteFillStyle,
    justifyContent: 'space-evenly',
    paddingHorizontal: 18,
  },
  gridLine: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.28)' },
  gridVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '68%',
    borderLeftWidth: StyleSheet.hairlineWidth,
    opacity: 0.3,
  },
  auraRing: {
    position: 'absolute',
    top: '18%',
    left: '14%',
    right: '14%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    opacity: 0.25,
  },
  zineLine: {
    position: 'absolute',
    top: '35%',
    left: -20,
    width: '120%',
    height: 2,
    opacity: 0.78,
    transform: [{ rotate: '-12deg' }],
  },
  zineSquare: {
    position: 'absolute',
    top: 22,
    right: 22,
    width: 24,
    height: 24,
    borderWidth: 1.2,
    opacity: 0.85,
  },
  rhythmTrack: {
    position: 'absolute',
    bottom: 14,
    left: 18,
    right: 18,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  rhythmBar: { height: 2 },
  footer: { padding: 18, gap: 10 },
  folderTitle: { fontSize: 22, lineHeight: 28 },
  serifTitle: { fontFamily: THEME.fonts.serif, fontWeight: '600', letterSpacing: 0.2 },
  monoTitle: {
    fontFamily: THEME.fonts.mono,
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  atmosphereNote: { color: 'rgba(244, 239, 230, 0.68)', fontSize: 12, lineHeight: 18 },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  trackLabel: { flex: 1, fontFamily: THEME.fonts.mono, fontSize: 11 },
  swatches: { flexDirection: 'row', gap: 5 },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
});