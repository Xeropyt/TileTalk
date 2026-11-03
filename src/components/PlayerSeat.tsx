import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WIND_CHARS, WIND_NAMES, Wind } from '../game/winds';
import { colors, radius } from '../theme';
import type { Player } from '../types';
import { formatPoints, Tile } from '../ui';

export function PlayerSeat({
  player,
  seatWind,
  score,
  absolute,
  isDealer,
  dealerStreak,
}: {
  player: Player;
  seatWind: Wind;
  score: number;
  /** Riichi scores are totals (25,000), not gains and losses, so they're shown plain. */
  absolute?: boolean;
  isDealer: boolean;
  dealerStreak: number;
}) {
  return (
    <View
      style={[styles.seat, isDealer && styles.seatDealer]}
      accessible
      accessibilityLabel={`${player.name}, ${WIND_NAMES[seatWind]} seat${isDealer ? ', dealer' : ''}, ${score} points`}
    >
      <Tile char={WIND_CHARS[seatWind]} size={34} color={isDealer ? colors.lacquer : colors.ink} />
      <Text style={styles.name} numberOfLines={1}>
        {player.avatar} {player.name}
      </Text>
      <Text style={[styles.score, !absolute && score > 0 && { color: colors.gain }, score < 0 && { color: colors.loss }]}>
        {absolute ? score.toLocaleString() : formatPoints(score)}
      </Text>
      {isDealer ? (
        <Text style={styles.dealer}>Dealer{dealerStreak > 0 ? ` ×${dealerStreak + 1}` : ''}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  seat: {
    width: 112,
    alignItems: 'center',
    gap: 4,
    padding: 10,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.feltLine,
    backgroundColor: colors.feltDeep,
  },
  seatDealer: { borderColor: colors.lacquer, borderWidth: 2 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600', maxWidth: 96 },
  score: { color: colors.text, fontSize: 20, fontWeight: '700' },
  dealer: { color: colors.ivory, fontSize: 12, fontWeight: '700' },
});
