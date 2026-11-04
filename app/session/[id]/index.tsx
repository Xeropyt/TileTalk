import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Protected, useSignedInUser } from '../../../src/auth';
import { DiceRoller } from '../../../src/components/Dice';
import { GameClock } from '../../../src/components/GameClock';
import { HandCard } from '../../../src/components/HandCard';
import { PayoutsCard, PayoutTotalsCard } from '../../../src/components/PayoutsCard';
import { PlayerSeat } from '../../../src/components/PlayerSeat';
import { deleteSession, endSession, subscribeHands, subscribeIsAdmin, subscribeSession } from '../../../src/db';
import { seatWindOf, WIND_CHARS, WIND_NAMES } from '../../../src/game/winds';
import { riichiFinalResults, riichiOptionsOf, rulesetFor } from '../../../src/scoring';
import { colors, radius } from '../../../src/theme';
import type { HandRecord, Session } from '../../../src/types';
import { Button, Card, ErrorText, formatPoints, Loading, Muted, Screen, SectionTitle, Tile } from '../../../src/ui';

export default function SessionPage() {
  return (
    <Protected>
      <SessionScreen />
    </Protected>
  );
}

function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [hands, setHands] = useState<HandRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const user = useSignedInUser();

  useEffect(() => subscribeSession(id, setSession, (e) => { setError(e.message); setSession(null); }), [id]);
  useEffect(() => subscribeHands(id, setHands, (e) => setError(e.message)), [id]);
  useEffect(() => subscribeIsAdmin(user.uid, setIsAdmin), [user.uid]);

  if (session === undefined || deleting) return <Loading />;
  if (session === null) return <Screen><Muted>This game doesn’t exist, or you’re not in its group.</Muted><ErrorText message={error} /></Screen>;

  const { table, players, scores } = session;
  const ruleset = rulesetFor(session.rulesetId, session.options);
  const isRiichi = ruleset.scoringModel === 'hanFu';
  const finished = session.status === 'finished';
  const nameOf = (pid: string | null) => players.find((p) => p.id === pid)?.name ?? 'Someone';

  // Fixed physical seating viewed from above: seat 0 at the bottom, then counter-clockwise.
  const seatView = (i: number) =>
    // Three-player games leave the left-hand seat empty.
    !players[i] ? (
      <View style={styles.emptySeat} />
    ) : (
      <PlayerSeat
        player={players[i]}
        seatWind={seatWindOf(i, table.dealerIndex, players.length)}
        score={scores[players[i].id] ?? 0}
        absolute={isRiichi}
        isDealer={!finished && table.dealerIndex === i}
        dealerStreak={table.dealerStreak}
      />
    );

  const riichi = isRiichi ? riichiOptionsOf(ruleset, session.options, players.length) : null;
  const standings = [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  const riichiResults = riichi
    ? riichiFinalResults(
        players.map((p) => p.id),
        scores,
        table.riichiSticks ?? 0,
        riichi,
      )
    : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: session.rulesetName }} />

      <View style={styles.table}>
        <View style={styles.tableRow}>{seatView(2)}</View>
        <View style={[styles.tableRow, styles.middleRow]}>
          {seatView(3)}
          <View style={styles.centre} accessible accessibilityLabel={`${WIND_NAMES[table.prevailingWind]} round, hand ${table.handNumber}`}>
            <Tile char={WIND_CHARS[table.prevailingWind]} size={52} color={colors.lacquer} />
            <Text style={styles.round}>{finished ? 'Game over' : `${WIND_NAMES[table.prevailingWind]} round`}</Text>
            {!finished ? <Muted>Hand {table.handNumber}</Muted> : null}
            <GameClock session={session} hands={hands} />
            {isRiichi && !finished ? (
              <Muted>
                {table.honba ?? 0} honba, {table.riichiSticks ?? 0} {table.riichiSticks === 1 ? 'stick' : 'sticks'}
              </Muted>
            ) : null}
          </View>
          {seatView(1)}
        </View>
        <View style={styles.tableRow}>{seatView(0)}</View>
      </View>

      <ErrorText message={error} />

      {finished && riichiResults ? (
        <Card>
          <SectionTitle>Final results</SectionTitle>
          {riichiResults.map((r) => {
            const p = players.find((x) => x.id === r.playerId)!;
            return (
              <View key={r.playerId} style={styles.standing}>
                <Text style={styles.standingText}>
                  {r.rank}. {p.avatar} {p.name}, {r.points.toLocaleString()}
                </Text>
                <Text style={[styles.standingText, { color: r.result >= 0 ? colors.gain : colors.loss }]}>
                  {r.result > 0 ? '+' : ''}
                  {r.result.toFixed(1)}
                </Text>
              </View>
            );
          })}
          <Muted>
            In thousands, after {riichi!.returnPoints.toLocaleString()} return points, oka to first place and uma{' '}
            {riichi!.uma.map((u) => (u > 0 ? `+${u}` : `${u}`)).join(' / ')}.
          </Muted>
        </Card>
      ) : finished ? (
        <Card>
          <SectionTitle>Final standings</SectionTitle>
          {standings.map((p, i) => (
            <View key={p.id} style={styles.standing}>
              <Text style={styles.standingText}>
                {i + 1}. {p.avatar} {p.name}
              </Text>
              <Text style={[styles.standingText, { color: (scores[p.id] ?? 0) >= 0 ? colors.gain : colors.loss }]}>
                {formatPoints(scores[p.id] ?? 0)}
              </Text>
            </View>
          ))}
        </Card>
      ) : (
        <>
          <Button title="Record hand" onPress={() => router.push(`/session/${session.id}/hand`)} />
          <PayoutsCard session={session} uid={user.uid} />
          <DiceRoller dealerIndex={table.dealerIndex} playerNames={players.map((p) => p.name)} />
        </>
      )}

      <SectionTitle>Hands</SectionTitle>
      {hands.length === 0 ? (
        <Muted>No hands yet. Roll the dice, play, then record the result.</Muted>
      ) : (
        hands.map((h) => <HandCard key={h.id} hand={h} ruleset={ruleset} nameOf={nameOf} />)
      )}
      <PayoutTotalsCard session={session} />

      {!finished ? (
        <Button
          title={confirmEnd ? 'Tap again to end the game now' : 'End game early'}
          variant="secondary"
          onPress={async () => {
            if (!confirmEnd) return setConfirmEnd(true);
            try {
              await endSession(session.id);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
      ) : null}
      <Muted>
        Rules: {ruleset.description} This game:{' '}
        {riichi
          ? `${riichi.gameLength === 'hanchan' ? 'hanchan' : 'East round only'}, ${riichi.startingPoints.toLocaleString()} start, uma ${riichi.uma.map((u) => (u > 0 ? `+${u}` : `${u}`)).join(' / ')}, ${players.length} players.`
          : `${ruleset.payment.minTai} to ${ruleset.payment.maxTai} tai, ${ruleset.payment.discard === 'shooterOnly' ? 'shooter pays for the table' : 'shooter pays double'}, ${players.length} players.`}
      </Muted>
      {/* Only admins can delete games. The Firestore rules enforce this too. */}
      {isAdmin ? (
        <>
          <Button
            title={confirmDelete ? 'Tap again to delete this game for everyone' : 'Delete game'}
            variant="secondary"
            onPress={async () => {
              if (!confirmDelete) return setConfirmDelete(true);
              setDeleting(true);
              try {
                await deleteSession(session.id);
                if (router.canGoBack()) router.back();
                else router.replace('/');
              } catch (e) {
                setError((e as Error).message);
                setDeleting(false);
                setConfirmDelete(false);
              }
            }}
          />
          <Muted>Deleting removes the game and its hands from everyone’s history and career stats.</Muted>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  table: {
    backgroundColor: colors.feltRaised,
    borderRadius: radius.card + 8,
    borderWidth: 1,
    borderColor: colors.feltLine,
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 10,
  },
  tableRow: { flexDirection: 'row', justifyContent: 'center' },
  middleRow: { justifyContent: 'space-between', alignItems: 'center' },
  emptySeat: { width: 112 },
  centre: { alignItems: 'center', gap: 6, flexShrink: 1 },
  round: { color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  standing: { flexDirection: 'row', justifyContent: 'space-between' },
  standingText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
