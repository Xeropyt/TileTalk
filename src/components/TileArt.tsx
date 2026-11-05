import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { tileName } from '../game/tiles';
import { themedStyles } from '../theme';

// Tile artwork lives in assets/tiles. Every tile is drawn as front.svg with the tile's own
// transparent SVG laid over it. Swap in new art by replacing the files, keeping the names.
const FRONT = require('../../assets/tiles/front.svg');
const ART: Record<string, number> = {
  man1: require('../../assets/tiles/man1.svg'),
  man2: require('../../assets/tiles/man2.svg'),
  man3: require('../../assets/tiles/man3.svg'),
  man4: require('../../assets/tiles/man4.svg'),
  man5: require('../../assets/tiles/man5.svg'),
  man6: require('../../assets/tiles/man6.svg'),
  man7: require('../../assets/tiles/man7.svg'),
  man8: require('../../assets/tiles/man8.svg'),
  man9: require('../../assets/tiles/man9.svg'),
  pin1: require('../../assets/tiles/pin1.svg'),
  pin2: require('../../assets/tiles/pin2.svg'),
  pin3: require('../../assets/tiles/pin3.svg'),
  pin4: require('../../assets/tiles/pin4.svg'),
  pin5: require('../../assets/tiles/pin5.svg'),
  pin6: require('../../assets/tiles/pin6.svg'),
  pin7: require('../../assets/tiles/pin7.svg'),
  pin8: require('../../assets/tiles/pin8.svg'),
  pin9: require('../../assets/tiles/pin9.svg'),
  sou1: require('../../assets/tiles/sou1.svg'),
  sou2: require('../../assets/tiles/sou2.svg'),
  sou3: require('../../assets/tiles/sou3.svg'),
  sou4: require('../../assets/tiles/sou4.svg'),
  sou5: require('../../assets/tiles/sou5.svg'),
  sou6: require('../../assets/tiles/sou6.svg'),
  sou7: require('../../assets/tiles/sou7.svg'),
  sou8: require('../../assets/tiles/sou8.svg'),
  sou9: require('../../assets/tiles/sou9.svg'),
  east: require('../../assets/tiles/east.svg'),
  south: require('../../assets/tiles/south.svg'),
  west: require('../../assets/tiles/west.svg'),
  north: require('../../assets/tiles/north.svg'),
  red: require('../../assets/tiles/red.svg'),
  green: require('../../assets/tiles/green.svg'),
  white: require('../../assets/tiles/white.svg'),
  flower1: require('../../assets/tiles/flower1.svg'),
  season1: require('../../assets/tiles/season1.svg'),
  flower2: require('../../assets/tiles/flower2.svg'),
  season2: require('../../assets/tiles/season2.svg'),
  flower3: require('../../assets/tiles/flower3.svg'),
  season3: require('../../assets/tiles/season3.svg'),
  flower4: require('../../assets/tiles/flower4.svg'),
  season4: require('../../assets/tiles/season4.svg'),
};

/** Tile artwork is 3 wide by 4 tall. */
const ASPECT = 3 / 4;
/** Flowers and seasons next to a hand, relative to the hand's tiles. */
const FLOWER_SCALE = 0.75;
/** Space between the tile's edge and its artwork, as a fraction of the width. 0 lays the art exactly over front.svg. */
const ART_INSET = 0;

/** One tile, drawn from the SVG artwork. Memoised: pickers redraw often, and each tile is two images. */
export const TileImage = React.memo(function TileImage({ code, width, dim }: { code: string; width: number; dim?: boolean }) {
  const inset = width * ART_INSET;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={tileName(code)}
      style={[{ width, height: width / ASPECT }, dim && { opacity: 0.35 }]}
    >
      <Image source={FRONT} style={StyleSheet.absoluteFill} contentFit="contain" />
      {ART[code] ? (
        <Image source={ART[code]} style={[StyleSheet.absoluteFill, { margin: inset }]} contentFit="contain" />
      ) : null}
    </View>
  );
});

/**
 * A whole hand, sized to fit the space it's given on one row, with flowers and seasons in a
 * smaller row underneath.
 */
export function HandView({
  tiles,
  flowers = [],
  maxTileWidth = 40,
  flowerScale = FLOWER_SCALE,
}: {
  tiles: string[];
  flowers?: string[];
  maxTileWidth?: number;
  /** Flower size relative to the hand's tiles. */
  flowerScale?: number;
}) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const gap = 2;
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const fit = (count: number, max: number) =>
    count === 0 || width === 0 ? 0 : Math.min(max, Math.floor((width - gap * (count - 1)) / count));
  const tileWidth = fit(Math.max(tiles.length, 14), maxTileWidth);
  // Flowers are set aside from the hand, so they're drawn smaller than its tiles.
  const flowerWidth = Math.round(tileWidth * flowerScale);

  return (
    <View onLayout={onLayout} style={styles.hand}>
      {width > 0 ? (
        <>
          <View style={[styles.row, { gap }]}>
            {tiles.map((t, i) => (
              <TileImage key={`${t}-${i}`} code={t} width={tileWidth} />
            ))}
          </View>
          {flowers.length > 0 ? (
            <View style={[styles.row, styles.flowers, { gap }]}>
              <Text style={styles.flowerLabel}>Flowers</Text>
              {flowers.map((t, i) => (
                <TileImage key={`${t}-${i}`} code={t} width={flowerWidth} />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  hand: { gap: 8, minHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  flowers: { alignItems: 'center' },
  flowerLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginRight: 6 },
}));
