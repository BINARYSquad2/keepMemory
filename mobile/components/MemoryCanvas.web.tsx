import React from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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

const absoluteFillStyle = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

export function MemoryCanvas({ memory }: MemoryCanvasProps) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth - 32, 420);
  const photoHeight = Math.round(cardWidth * 1.18);
  const { style, track } = memory;
  const [bgCol, accentCol, lightCol] = style.palette;
  const photoUri = /^(https?:|data:image\/|blob:)/i.test(memory.photoUri)
    ? memory.photoUri
    : null;
  const isSerif = style.typographyVariant === 'serif_editorial';

  return (
    <View
      style={[
        styles.frame,
        { width: cardWidth, backgroundColor: bgCol, borderColor: 'rgba(255,255,255,0.14)' },
      ]}
    >
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

      <View
        style={[
          styles.artwork,
          { width: cardWidth - 2, height: photoHeight, backgroundColor: bgCol },
        ]}
      >
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            resizeMode="cover"
            style={absoluteFillStyle}
          />
        ) : null}
        <View
          pointerEvents="none"
          style={[styles.colorWash, { backgroundColor: accentCol, opacity: 0.18 }]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.aura,
            styles.auraTop,
            { backgroundColor: accentCol, opacity: 0.3 },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.aura,
            styles.auraBottom,
            { backgroundColor: lightCol, opacity: 0.14 },
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
        {style.artStyle === 'kinetic_zine' ? (
          <View pointerEvents="none" style={[styles.zineLine, { backgroundColor: accentCol }]} />
        ) : null}
        <View style={styles.rhythmTrack}>
          <View
            style={[
              styles.rhythmBar,
              { width: `${Math.min(100, Math.max(18, track.energy * 100))}%`, backgroundColor: accentCol },
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
  zineLine: {
    position: 'absolute',
    top: '35%',
    left: -20,
    width: '120%',
    height: 2,
    opacity: 0.7,
    transform: [{ rotate: '-12deg' }],
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
  atmosphereNote: { color: 'rgba(244, 239, 230, 0.65)', fontSize: 12, lineHeight: 18 },
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
