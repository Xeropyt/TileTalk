import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BONUS_TILES, HAND_TILES, MAX_HAND_TILES, maxCopies, MIN_HAND_TILES, sortTiles, tileName } from '../game/tiles';
import { radius, themedStyles } from '../theme';
import { Button, Muted, Row } from '../ui';
import { TileImage } from './TileArt';

const PICKER_GROUPS: { name: string; tiles: string[] }[] = [
  { name: 'Characters', tiles: HAND_TILES.slice(0, 9) },
  { name: 'Dots', tiles: HAND_TILES.slice(9, 18) },
  { name: 'Bamboo', tiles: HAND_TILES.slice(18, 27) },
  { name: 'Winds and dragons', tiles: HAND_TILES.slice(27) },
  { name: 'Flowers and seasons', tiles: BONUS_TILES },
];
// Picker tiles fill the width, nine to a row (one suit), with small gaps so they're easy to hit
// on a phone. Capped so they don't get huge on tablets and computers.
const PICKER_GAP = 3;
const PICKER_TILE_MIN = 30;
const PICKER_TILE_MAX = 46;
const LAID_TILE = 30;

/**
 * Lay out a hand by tapping tiles: up to four of each, one of each flower, 14 tiles plus one per
 * kong. Tap a laid tile to take it back out.
 */
export function TilePicker({
  tiles,
  flowers,
  onChange,
  onError,
}: {
  tiles: string[];
  flowers: string[];
  onChange: (tiles: string[], flowers: string[]) => void;
  onError?: (message: string | null) => void;
}) {
  const styles = useStyles();
  const used = (code: string) => [...tiles, ...flowers].filter((t) => t === code).length;
  const [gridWidth, setGridWidth] = useState(0);
  const pickerTile = gridWidth
    ? Math.max(PICKER_TILE_MIN, Math.min(PICKER_TILE_MAX, Math.floor((gridWidth - PICKER_GAP * 8) / 9)))
    : PICKER_TILE_MIN;

  const add = (code: string) => {
    onError?.(null);
    if (used(code) >= maxCopies(code)) return;
    if (BONUS_TILES.includes(code)) return onChange(tiles, sortTiles([...flowers, code]));
    if (tiles.length >= MAX_HAND_TILES) return onError?.(`A hand has at most ${MAX_HAND_TILES} tiles, with four kongs.`);
    onChange([...tiles, code], flowers);
  };

  return (
    <>
      <Muted>
        Tap tiles below to lay out your hand. Tap a tile here to take it out. {tiles.length} of {MIN_HAND_TILES} tiles
        {tiles.length > MIN_HAND_TILES ? ` (+${tiles.length - MIN_HAND_TILES} for kongs)` : ''}.
      </Muted>
      <View style={styles.laid}>
        {tiles.length === 0 ? <Muted>No tiles yet.</Muted> : null}
        {tiles.map((t, i) => (
          <Pressable
            key={`${t}-${i}`}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${tileName(t)}`}
            onPress={() => onChange(tiles.filter((_, j) => j !== i), flowers)}
          >
            <TileImage code={t} width={LAID_TILE} />
          </Pressable>
        ))}
      </View>
      {flowers.length > 0 ? (
        <View style={styles.laid}>
          <Text style={styles.flowerLabel}>Flowers</Text>
          {flowers.map((t) => (
            <Pressable
              key={t}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${tileName(t)}`}
              onPress={() => onChange(tiles, flowers.filter((f) => f !== t))}
            >
              <TileImage code={t} width={LAID_TILE * 0.8} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <Row>
        <Button title="Sort" variant="secondary" onPress={() => onChange(sortTiles(tiles), flowers)} disabled={tiles.length < 2} />
        <Button title="Clear" variant="secondary" onPress={() => onChange([], [])} disabled={tiles.length + flowers.length === 0} />
      </Row>

      <View style={styles.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
        {PICKER_GROUPS.map((g) => (
          <View key={g.name} style={styles.group}>
            <Text style={styles.groupName}>{g.name}</Text>
            <View style={styles.picker}>
              {g.tiles.map((t) => {
                const left = maxCopies(t) - used(t);
                return (
                  <Pressable
                    key={t}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${tileName(t)}`}
                    accessibilityState={{ disabled: left === 0 }}
                    disabled={left === 0}
                    onPress={() => add(t)}
                    style={({ pressed }) => pressed && { opacity: 0.7 }}
                  >
                    <TileImage code={t} width={pickerTile} dim={left === 0} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

const useStyles = themedStyles((colors) => ({
  laid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 3,
    minHeight: 48,
    padding: 8,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceDeep,
  },
  flowerLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginRight: 6 },
  // Reaches a little past the page's margins, for bigger tiles.
  grid: { marginHorizontal: -8, gap: 12 },
  group: { gap: 6 },
  groupName: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginHorizontal: 8 },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: PICKER_GAP },
}));
