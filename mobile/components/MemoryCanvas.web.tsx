import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
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

const absoluteFillStyle = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

export function MemoryCanvas({
  memory,
  isPlaying = false,
  activePhotoIndex,
  onSelectPhoto,
}: MemoryCanvasProps) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth - 32, 420);
  const photoHeight = Math.round(cardWidth * 1.18);

  const photos = useMemo(() => getMemoryPhotos(memory), [memory]);
  const [internalIndex, setInternalIndex] = useState(0);
  const photoCount = photos.length;
  const currentIndex =
    photoCount > 0 ? (activePhotoIndex ?? internalIndex) % photoCount : 0;

  const { style, track } = memory;
  const [
    bgCol = THEME.colors.bg,
    accentCol = THEME.colors.accent,
    lightCol = THEME.colors.text,
  ] = style.palette ?? [];
  const modeMeta = ART_STYLE_META[style.artStyle] ?? ART_STYLE_META.analog_film;
  const atmosphere = useMemo(() => analyzeDayAtmosphere(memory), [memory]);

  const rawPhotoUri = photos[currentIndex] ?? memory.photoUri;
  const photoUri = /^(https?:|data:image\/|blob:)/i.test(rawPhotoUri)
    ? rawPhotoUri
    : null;
  const isSerif = style.typographyVariant === 'serif_editorial';

  const pulse = useRef(new Animated.Value(0)).current;

  const selectIndex = (nextIndex: number) => {
    if (photoCount <= 1) return;
    const normalized = ((nextIndex % photoCount) + photoCount) % photoCount;
    if (onSelectPhoto) {
      onSelectPhoto(normalized);
    } else {
      setInternalIndex(normalized);
    }
  };

  useEffect(() => {
    if (!isPlaying || photoCount <= 1) return;
    const speed = Math.max(0.45, style.motionSpeed || 1);
    const intervalMs = Math.max(1900, Math.round(4400 / speed));

    const timer = setInterval(() => {
      selectIndex(currentIndex + 1);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, photoCount, currentIndex, style.motionSpeed]);

  useEffect(() => {
    const speed = Math.max(0.25, style.motionSpeed || 1);
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
        { width: cardWidth, backgroundColor: bgCol, borderColor: 'rgba(255,255,255,0.16)' },
      ]}
    >
      <View style={styles.metaBar}>
        <View style={styles.metaLeft}>
          <View
            style={[
              styles.liveDot,
              { backgroundColor: accentCol, opacity: isPlaying ? 1 : 0.65 },
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

      <Pressable
        onPress={() => selectIndex(currentIndex + 1)}
        disabled={photoCount <= 1}
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
                FRAME 0{currentIndex + 1}/0{photoCount}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.rhythmTrack}>
          <Animated.View
            style={[
              styles.rhythmBar,
              { width: barWidth, backgroundColor: accentCol },
            ]}
          />
        </View>
      </Pressable>

      <View style={styles.footer}>
        <View style={styles.moodRow}>
          <View style={[styles.moodPill, { borderColor: accentCol }]}>
            <Text style={[styles.moodPillText, { color: accentCol }]}>
              {atmosphere.moodBadge}
            </Text>
          </View>
          {photoCount > 1 ? (
            <Text style={styles.albumHint}>
              {isPlaying ? 'Смена в ритме трека' : 'Кликни кадр · альбом'}
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
            {(style.palette ?? []).map((color, index) => (
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
  albumOverlayTop: {
    position: 'absolute',
    top: 10,
    left: 14,
    right: 14,
    gap: 8,
  },
  segmentsRow: { flexDirection: 'row', gap: 5 },
  segmentTrack: {
    flex: 1,
    height: 2.5,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  frameTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(6, 6, 9, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.xs,
  },
  frameTagText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
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
  footer: { padding: 18, gap: 9 },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  moodPill: {
    borderWidth: 1,
    borderRadius: THEME.radius.xs,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(6, 6, 9, 0.35)',
  },
  moodPillText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  albumHint: {
    fontFamily: THEME.fonts.mono,
    fontSize: 9,
    color: 'rgba(244, 239, 230, 0.5)',
  },
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
  atmosphereNote: { color: 'rgba(244, 239, 230, 0.72)', fontSize: 12, lineHeight: 18 },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 7,
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