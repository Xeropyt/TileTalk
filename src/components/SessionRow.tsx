import React from 'react';
import { Pressable, Text } from 'react-native';
import { Link } from 'expo-router';
import { formatClock, formatDuration } from '../game/history';
import { WIND_NAMES } from '../game/winds';
import { radius, themedStyles } from '../theme';
import type { Session } from '../types';
import { formatPoints, Muted } from '../ui';
import { playingTime, useNow } from './GameClock';

export function SessionRow({ session, groupName }: { session: Session; groupName?: string }) {
  const styles = useStyles();
  const leader = [...session.players].sort((a, b) => (session.scores[b.id] ?? 0) - (session.scores[a.id] ?? 0))[0];
  const date = session.createdAt ? new Date(session.createdAt.toMillis()).toLocaleDateString() : 'Today';
  const detail =
    session.status === 'active'
      ? `${WIND_NAMES[session.table.prevailingWind]} round, hand ${session.table.handNumber}`
      : `Winner: ${leader?.name} (${formatPoints(session.scores[leader?.id] ?? 0)})`;
  // In-progress games tick, so the table can see how long they've been playing without opening it.
  const active = session.status === 'active';
  const now = useNow(active);
  const played = playingTime(session, [], now);
  return (
    <Link href={`/session/${session.id}`} asChild>
      <Pressable style={({ pressed }) => [styles.session, pressed && { opacity: 0.75 }]} accessibilityRole="button">
        <Text style={styles.sessionTitle}>{session.players.map((p) => p.name).join(', ')}</Text>
        <Muted>
          {groupName ? `${groupName}. ` : ''}
          {date}. {detail}
          {played === null ? '' : active ? `. ⏱ ${formatClock(played)}` : `. Played ${formatDuration(played)}`}
        </Muted>
      </Pressable>
    </Link>
  );
}

const useStyles = themedStyles((colors) => ({
  session: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
  sessionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
}));
