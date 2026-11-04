import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Link } from 'expo-router';
import { formatDuration } from '../game/history';
import { WIND_NAMES } from '../game/winds';
import { colors, radius } from '../theme';
import type { Session } from '../types';
import { formatPoints, Muted } from '../ui';
import { playingTime } from './GameClock';

export function SessionRow({ session, groupName }: { session: Session; groupName?: string }) {
  const leader = [...session.players].sort((a, b) => (session.scores[b.id] ?? 0) - (session.scores[a.id] ?? 0))[0];
  const date = session.createdAt ? new Date(session.createdAt.toMillis()).toLocaleDateString() : 'Today';
  const detail =
    session.status === 'active'
      ? `${WIND_NAMES[session.table.prevailingWind]} round, hand ${session.table.handNumber}`
      : `Winner: ${leader?.name} (${formatPoints(session.scores[leader?.id] ?? 0)})`;
  const played = session.status === 'finished' ? playingTime(session) : null;
  return (
    <Link href={`/session/${session.id}`} asChild>
      <Pressable style={({ pressed }) => [styles.session, pressed && { opacity: 0.75 }]} accessibilityRole="button">
        <Text style={styles.sessionTitle}>{session.players.map((p) => p.name).join(', ')}</Text>
        <Muted>
          {groupName ? `${groupName}. ` : ''}
          {date}. {detail}
          {played !== null ? `. Played ${formatDuration(played)}` : ''}
        </Muted>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  session: {
    backgroundColor: colors.feltRaised,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.feltLine,
    padding: 16,
    gap: 4,
  },
  sessionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
