import React from 'react';
import { Text, View } from 'react-native';
import { handName } from '../game/history';
import { WIND_NAMES } from '../game/winds';
import { limitName, Ruleset, unitOf } from '../scoring';
import { colors, radius, themedStyles } from '../theme';
import type { HandRecord } from '../types';
import { formatPoints, Muted } from '../ui';
import { HandView } from './TileArt';

/** One hand in the history. Wins stand out with a gold edge and the hand's name. */
export function HandCard({ hand: h, ruleset, nameOf }: { hand: HandRecord; ruleset: Ruleset; nameOf: (id: string | null) => string }) {
  const styles = useStyles();
  const when = `Hand ${h.handNumber}, ${WIND_NAMES[h.prevailingWind]} round`;
  if (h.result !== 'win') {
    const text = h.riichi
      ? describeRiichi(h, nameOf)
      : h.result === 'draw'
        ? 'Draw, no winner.'
        : `${nameOf(h.offenderId ?? null)} declared a false win (詐胡) and paid everyone ${h.payout}. Replayed.`;
    return (
      <View style={[styles.hand, h.result === 'falseWin' && styles.falseWin]}>
        <Text style={styles.handWhen}>{when}</Text>
        <Muted>{text}</Muted>
      </View>
    );
  }

  const gain = h.payments[h.winnerId ?? ''] ?? 0;
  const how = h.winType === 'selfDraw' ? 'self-drew' : `won off ${nameOf(h.discarderId)}`;
  // Riichi hands are named by their value until yaku are recorded.
  const title = h.riichi ? describeRiichi(h, nameOf) : (handName(ruleset, h.patterns) ?? `${h.tai} ${unitOf(ruleset)}`);
  return (
    <View style={[styles.hand, styles.win]}>
      <View style={styles.winHeader}>
        <Text style={styles.winTitle}>{title}</Text>
        {h.riichi ? null : (
          <Text style={styles.taiBadge}>
            {h.tai} {unitOf(ruleset)}
          </Text>
        )}
      </View>
      <Text style={styles.winDetail}>
        {h.riichi ? '' : `${nameOf(h.winnerId)} ${how}, `}
        <Text style={{ color: colors.success }}>{formatPoints(gain)}</Text>
      </Text>
      {/* Hands recorded with the tile calculator keep their tiles. */}
      {h.tiles?.length ? <HandView tiles={h.tiles} flowers={h.flowers ?? []} maxTileWidth={26} /> : null}
      <Text style={styles.handWhen}>{when}</Text>
    </View>
  );
}

function describeRiichi(h: HandRecord, nameOf: (id: string | null) => string): string {
  const r = h.riichi!;
  const riichis = r.declarers.length ? ` Riichi: ${r.declarers.map(nameOf).join(', ')}.` : '';
  if (h.result === 'falseWin') return `${nameOf(h.offenderId ?? null)} made a chombo and paid a reverse mangan. Replayed.`;
  if (r.drawType === 'abortive') return `Abortive draw. Replayed.${riichis}`;
  if (r.drawType === 'exhaustive') {
    if (r.nagashiId) return `Exhaustive draw: ${nameOf(r.nagashiId)} scored nagashi mangan.${riichis}`;
    return `Exhaustive draw. Tenpai: ${r.tenpai.length ? r.tenpai.map(nameOf).join(', ') : 'nobody'}.${riichis}`;
  }
  const wins = r.winners.map((w) => {
    const value = limitName(w.base) ?? `${w.han} han ${w.fu} fu`;
    return `${nameOf(w.playerId)} ${value}`;
  });
  const how = h.winType === 'selfDraw' ? 'by tsumo' : `off ${nameOf(h.discarderId)}`;
  return `${wins.join(' and ')} ${how}${r.winners.length > 1 ? ' (double ron)' : ''}.${riichis}`;
}

const useStyles = themedStyles((colors) => ({
  hand: {
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.control,
    padding: 12,
    gap: 2,
  },
  handWhen: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  falseWin: { borderLeftWidth: 4, borderLeftColor: colors.error },
  // Gold edge: winning hands, set apart from the blue-edged immediate payouts.
  win: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderLeftWidth: 5,
    padding: 14,
    gap: 4,
  },
  winHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  winTitle: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '800', lineHeight: 23 },
  taiBadge: {
    backgroundColor: colors.accent,
    color: colors.onAccent,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  winDetail: { color: colors.text, fontSize: 15, fontWeight: '600' },
}));
