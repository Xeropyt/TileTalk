import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Protected, useSignedInUser } from '../../../src/auth';
import { DiceRoller } from '../../../src/components/Dice';
import { GameClock } from '../../../src/components/GameClock';
import { HandCard } from '../../../src/components/HandCard';
import { PayoutsCard, PayoutTotalsCard } from '../../../src/components/PayoutsCard';
import { PlayerSeat } from '../../../src/components/PlayerSeat';
import { deleteSession, endSession, subscribeHands, subscribeIsAdmin, subscribeSession } from '../../../src/db';
import { seatWindOf, WIND_CHARS, WIND_NAMES } from '../../../src/game/winds';
import { riichiFinalResults, riichiOptionsOf, rulesetFor, unitOf } from '../../../src/scoring';
import { colors, radius, themedStyles } from '../../../src/theme';
import type { HandRecord, Session } from '../../../src/types';
import { Button, Card, ErrorText, formatPoints, Loading, Muted, Row, Screen, SectionTitle, Tile } from '../../../src/ui';

// Wins above this many tai (or faan, or han) are top hands, shown before the full breakdown.
const TOP_HAND_TAI = 3;

export default function SessionPage() {
  return (
    <Protected>
      <SessionScreen />
    </Protected>
  );
}

function SessionScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [hands, setHands] = useState<HandRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAllHands, setShowAllHands] = useState(false);
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
  // Biggest first; equal hands stay newest first.
  const topHands = hands.filter((h) => h.result === 'win' && h.tai > TOP_HAND_TAI).sort((a, b) => b.tai - a.tai);
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
            <Tile char={WIND_CHARS[table.prevailingWind]} size={52} color={colors.tileRed} />
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
                <Text style={[styles.standingText, { color: r.result >= 0 ? colors.success : colors.error }]}>
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
              <Text style={[styles.standingText, { color: (scores[p.id] ?? 0) >= 0 ? colors.success : colors.error }]}>
                {formatPoints(scores[p.id] ?? 0)}
              </Text>
            </View>
          ))}
        </Card>
      ) : (
        <>
          <Row style={styles.recordRow}>
            <Button title="Record hand" style={styles.recordButton} onPress={() => router.push(`/session/${session.id}/hand`)} />
            {/* The tile calculator only knows tai scoring for now. */}
            {!isRiichi ? (
              <Button
                title="Record by tiles"
                variant="secondary"
                style={styles.recordButton}
                onPress={() => router.push(`/session/${session.id}/hand?mode=tiles`)}
              />
            ) : null}
          </Row>
          <PayoutsCard session={session} uid={user.uid} />
          <DiceRoller dealerIndex={table.dealerIndex} playerNames={players.map((p) => p.name)} />
        </>
      )}

      <SectionTitle>Top hands</SectionTitle>
      {hands.length === 0 ? (
        <Muted>No hands yet. Roll the dice, play, then record the result.</Muted>
      ) : topHands.length === 0 ? (
        <Muted>
          No wins above {TOP_HAND_TAI} {unitOf(ruleset)} yet.
        </Muted>
      ) : (
        topHands.map((h) => <HandCard key={h.id} hand={h} ruleset={ruleset} nameOf={nameOf} />)
      )}
      {hands.length > 0 ? (
        <Button
          title={showAllHands ? 'Hide full breakdown' : `See full breakdown (${hands.length} ${hands.length === 1 ? 'hand' : 'hands'})`}
          variant="secondary"
          onPress={() => setShowAllHands(!showAllHands)}
        />
      ) : null}
      {showAllHands ? (
        <>
          <SectionTitle>Every hand</SectionTitle>
          {hands.map((h) => (
            <HandCard key={h.id} hand={h} ruleset={ruleset} nameOf={nameOf} />
          ))}
        </>
      ) : null}
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
          : `${ruleset.payment.minTai} to ${ruleset.payment.maxTai} ${unitOf(ruleset)}, ${ruleset.payment.discard === 'shooterOnly' ? 'shooter pays for the table' : 'shooter pays double'}, ${players.length} players.`}
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
                else router.replace('/?tab=games');
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

const useStyles = themedStyles((colors) => ({
  table: {
    backgroundColor: colors.surface,
    borderRadius: radius.card + 8,
    borderWidth: 1,
    borderColor: colors.border,
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
  recordRow: { flexWrap: 'nowrap' },
  recordButton: { flex: 1 },
  standingText: { color: colors.text, fontSize: 16, fontWeight: '600' },
}));
