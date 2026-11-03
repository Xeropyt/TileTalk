import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Protected, useSignedInUser } from '../../../src/auth';
import { DiceRoller } from '../../../src/components/Dice';
import { PlayerSeat } from '../../../src/components/PlayerSeat';
import { deleteSession, endSession, subscribeHands, subscribeSession } from '../../../src/db';
import { seatWindOf, WIND_CHARS, WIND_NAMES } from '../../../src/game/winds';
import { getRuleset } from '../../../src/scoring';
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
  const user = useSignedInUser();

  useEffect(() => subscribeSession(id, setSession, (e) => { setError(e.message); setSession(null); }), [id]);
  useEffect(() => subscribeHands(id, setHands, (e) => setError(e.message)), [id]);

  if (session === undefined || deleting) return <Loading />;
  if (session === null) return <Screen><Muted>This game doesn’t exist, or you’re not in its group.</Muted><ErrorText message={error} /></Screen>;

  const { table, players, scores } = session;
  const finished = session.status === 'finished';
  const nameOf = (pid: string | null) => players.find((p) => p.id === pid)?.name ?? 'Someone';

  // Fixed physical seating viewed from above: seat 0 at the bottom, then counter-clockwise.
  const seatView = (i: number) => (
    <PlayerSeat
      player={players[i]}
      seatWind={seatWindOf(i, table.dealerIndex)}
      score={scores[players[i].id] ?? 0}
      isDealer={!finished && table.dealerIndex === i}
      dealerStreak={table.dealerStreak}
    />
  );

  const standings = [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));

  const describe = (h: HandRecord) => {
    if (h.result === 'draw') return 'Draw, no winner';
    if (h.result === 'falseWin') return `${nameOf(h.offenderId ?? null)} declared a false win (詐胡) and paid everyone ${h.payout}. Replayed.`;
    if (h.winType === 'selfDraw') return `${nameOf(h.winnerId)} self-drew ${h.tai} tai`;
    return `${nameOf(h.winnerId)} won ${h.tai} tai off ${nameOf(h.discarderId)}`;
  };

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
          </View>
          {seatView(1)}
        </View>
        <View style={styles.tableRow}>{seatView(0)}</View>
      </View>

      <ErrorText message={error} />

      {finished ? (
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
          <Button title="Scan winning hand" variant="secondary" onPress={() => router.push(`/scan?sessionId=${session.id}`)} />
          <DiceRoller dealerIndex={table.dealerIndex} playerNames={players.map((p) => p.name)} />
        </>
      )}

      <SectionTitle>Hands</SectionTitle>
      {hands.length === 0 ? (
        <Muted>No hands yet. Roll the dice, play, then record the result.</Muted>
      ) : (
        hands.map((h) => (
          <View key={h.id} style={styles.hand}>
            <Text style={styles.handTitle}>
              Hand {h.handNumber}, {WIND_NAMES[h.prevailingWind]} round
            </Text>
            <Muted>{describe(h)}</Muted>
          </View>
        ))
      )}

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
      <Muted>Rules: {getRuleset(session.rulesetId).description}</Muted>
      {session.createdBy === user.uid ? (
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
  centre: { alignItems: 'center', gap: 6, flexShrink: 1 },
  round: { color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  standing: { flexDirection: 'row', justifyContent: 'space-between' },
  standingText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  hand: {
    backgroundColor: colors.feltDeep,
    borderRadius: radius.control,
    padding: 12,
    gap: 2,
  },
  handTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
