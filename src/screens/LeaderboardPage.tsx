import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { displayNameOf, Protected, useAuth, useSignedInUser } from '../auth';
import { TitleBadge } from '../components/TitleCard';
import { subscribeLeaderboard } from '../db';
import { useResultTotals, withResultStats } from '../stats';
import { LEADERBOARD_SORTS, LeaderboardSort, rankPlayers } from '../game/leaderboard';
import { shownTitles } from '../game/titles';
import { colors, radius, themedStyles } from '../theme';
import type { UserProfile } from '../types';
import { Button, Card, Chip, ErrorText, formatPoints, Loading, Muted, Row, SectionTitle, Title } from '../ui';
import { TabPage } from './TabPage';

const SORT_ORDER: LeaderboardSort[] = ['winRate', 'wins', 'netPoints', 'biggestTai', 'avgTai'];

function formatValue(sort: LeaderboardSort, v: number): string {
  switch (sort) {
    case 'winRate':
      return `${Math.round(v * 100)}%`;
    case 'netPoints':
      return formatPoints(v);
    case 'biggestTai':
      return `${v} tai`;
    case 'avgTai':
      return `${v.toFixed(1)} tai`;
    default:
      return `${v}`;
  }
}

export function LeaderboardPage() {
  return (
    <Protected>
      <LeaderboardContent />
    </Protected>
  );
}

function LeaderboardContent() {
  const styles = useStyles();
  const user = useSignedInUser();
  const { isGuest } = useAuth();
  const [sort, setSort] = useState<LeaderboardSort>('winRate');
  const [players, setPlayers] = useState<UserProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeLeaderboard(setPlayers, (e) => setError(e.message)), []);

  // Stats come from each finished game, so the board moves the moment a game ends.
  const { totals, error: resultsError } = useResultTotals();
  const { ranked, notRanked } = players ? rankPlayers(players.map((p) => withResultStats(p, totals)), sort) : { ranked: [], notRanked: 0 };
  const def = LEADERBOARD_SORTS[sort];

  return (
    <TabPage>
      <Title>Leaderboard</Title>
      <Muted>Everyone with an account, ranked on career stats. It updates at the end of every game.</Muted>

      <Row>
        {SORT_ORDER.map((id) => (
          <Chip key={id} label={LEADERBOARD_SORTS[id].label} selected={sort === id} onPress={() => setSort(id)} />
        ))}
      </Row>

      {isGuest ? (
        <Card>
          <SectionTitle>You’re not on the board yet</SectionTitle>
          <Muted>Guests aren’t ranked. Create an account and everything you’ve played so far counts.</Muted>
          <Button title="Create account" onPress={() => router.push('/login?mode=signup')} />
        </Card>
      ) : null}

      <ErrorText message={error ?? resultsError} />

      {players === null ? (
        <Loading />
      ) : ranked.length === 0 ? (
        <Muted>Nobody qualifies for this board yet.</Muted>
      ) : (
        <View style={styles.list}>
          {ranked.map((r) => {
            const me = r.profile.uid === user.uid;
            const topTitle = shownTitles(r.profile)[0];
            return (
              <Pressable
                key={r.profile.uid}
                style={({ pressed }) => [styles.row, me && styles.rowMe, pressed && { opacity: 0.8 }]}
                onPress={() => router.push({ pathname: '/player/[uid]', params: { uid: r.profile.uid } })}
                accessibilityRole="button"
                accessibilityLabel={`${r.rank}. ${displayNameOf(r.profile)}${me ? ' (you)' : ''}${topTitle ? `, ${topTitle.def.name}` : ''}, ${def.label} ${formatValue(sort, r.value)}`}
                accessibilityHint="Opens their profile"
              >
                <Text style={[styles.rank, r.rank <= 3 && styles.rankTop, me && styles.nameMe]}>{r.rank}</Text>
                <Text style={styles.avatar}>{r.profile.avatar}</Text>
                <View style={styles.who}>
                  <Text style={[styles.name, me && styles.nameMe]} numberOfLines={1}>
                    {displayNameOf(r.profile)}
                    {me ? ' (you)' : ''}
                  </Text>
                  {topTitle ? <TitleBadge def={topTitle.def} color={me ? colors.onHighlight : undefined} /> : null}
                  <Muted style={me ? styles.mutedMe : undefined}>
                    {r.stats.handsPlayed} hands, {r.stats.wins} wins
                  </Muted>
                </View>
                <Text style={[styles.value, me && styles.nameMe]}>{formatValue(sort, r.value)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {notRanked > 0 && def.eligibility ? (
        <Muted>
          {notRanked} {notRanked === 1 ? 'player needs' : 'players need'} {def.eligibility} to be ranked by {def.label.toLowerCase()}.
        </Muted>
      ) : null}
    </TabPage>
  );
}

const useStyles = themedStyles((colors) => ({
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rowMe: { backgroundColor: colors.highlight, borderColor: colors.highlight },
  rank: { color: colors.textMuted, fontSize: 16, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  rankTop: { color: colors.highlight, fontSize: 18 },
  avatar: { fontSize: 24 },
  who: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  nameMe: { color: colors.onHighlight },
  mutedMe: { color: colors.onHighlight, opacity: 0.7 },
  value: { color: colors.text, fontSize: 18, fontWeight: '700' },
}));
