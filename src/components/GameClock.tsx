import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { formatClock, formatDuration } from '../game/history';
import { colors } from '../theme';
import type { HandRecord, Session } from '../types';

/**
 * How long a game has been played: from the start to the end, or to now while it's running.
 * Games that ended before end times were saved fall back to their last hand. Null if unknown.
 */
export function playingTime(session: Session, hands: HandRecord[] = [], now = Date.now()): number | null {
  const start = session.createdAt?.toMillis();
  if (start === undefined) return null;
  if (session.status === 'active') return now - start;
  const end = session.finishedAt?.toMillis() ?? Math.max(0, ...hands.map((h) => h.createdAt?.toMillis() ?? 0));
  return end > start ? end - start : null;
}

/** A ticking clock while the game runs, and the total once it's over. */
export function GameClock({ session, hands }: { session: Session; hands: HandRecord[] }) {
  const active = session.status === 'active';
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  const ms = playingTime(session, hands, now);
  if (ms === null) return null;
  return (
    <Text style={styles.clock} accessibilityLabel={`Playing time ${formatDuration(ms)}`}>
      ⏱ {active ? formatClock(ms) : `Played ${formatDuration(ms)}`}
    </Text>
  );
}

const styles = StyleSheet.create({
  clock: { color: colors.muted, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
