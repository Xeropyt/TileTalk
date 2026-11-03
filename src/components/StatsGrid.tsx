import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import type { PlayerStats } from '../types';
import { formatPoints, Muted } from '../ui';

export function StatsGrid({ stats: s }: { stats: PlayerStats }) {
  const rows: [string, string][] = [
    ['Hands played', `${s.handsPlayed}`],
    ['Wins', `${s.wins}`],
    ['Win rate', `${s.handsPlayed ? Math.round((s.wins / s.handsPlayed) * 100) : 0}%`],
    ['Self-draws', `${s.selfDraws}`],
    ['Deal-in rate', `${s.handsPlayed ? Math.round((s.dealIns / s.handsPlayed) * 100) : 0}%`],
    ['Average tai', s.wins ? (s.totalTai / s.wins).toFixed(1) : '0'],
    ['Biggest hand', `${s.biggestTai} tai`],
    ['Net points', formatPoints(s.netPoints)],
  ];
  return (
    <View style={styles.grid}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.stat}>
          <Text style={styles.value}>{value}</Text>
          <Muted>{label}</Muted>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.feltRaised,
    borderRadius: radius.card,
    padding: 14,
    gap: 2,
  },
  value: { color: colors.text, fontSize: 24, fontWeight: '700' },
});
