import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Protected, useSignedInUser } from '../../../src/auth';
import { recordHand, subscribeSession } from '../../../src/db';
import {
  blockedBy,
  calculatePayments,
  ClaimedPattern,
  contextProblem,
  falseWinPayments,
  falseWinPenalty,
  getRuleset,
  HandContext,
  maxCountFor,
  PATTERN_GROUP_NAMES,
  PatternGroup,
  scoreHand,
  WinType,
} from '../../../src/scoring';
import { colors, radius } from '../../../src/theme';
import type { HandResult, Player, Session } from '../../../src/types';
import { Button, Card, Chip, ErrorText, formatPoints, Loading, Muted, Row, Screen, SectionTitle, Stepper } from '../../../src/ui';

export default function RecordHandPage() {
  return (
    <Protected>
      <RecordHandScreen />
    </Protected>
  );
}

const GROUP_ORDER: PatternGroup[] = ['bonus', 'sets', 'shape', 'winning', 'limit'];

function RecordHandScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useSignedInUser();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [result, setResult] = useState<HandResult>('win');
  const [offenderId, setOffenderId] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [winType, setWinType] = useState<WinType>('discard');
  const [discarderId, setDiscarderId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeSession(id, setSession, (e) => { setError(e.message); setSession(null); }), [id]);

  const ruleset = getRuleset(session?.rulesetId ?? 'house');
  const claimed: ClaimedPattern[] = useMemo(
    () => Object.entries(counts).filter(([, c]) => c > 0).map(([pid, count]) => ({ id: pid, count })),
    [counts],
  );
  const dealerId = session ? session.players[session.table.dealerIndex]?.id : undefined;
  const context: HandContext = useMemo(
    () => ({ winType, isDealer: winnerId && dealerId ? winnerId === dealerId : undefined }),
    [winType, winnerId, dealerId],
  );
  const score = useMemo(() => scoreHand(ruleset, claimed, context), [ruleset, claimed, context]);

  if (session === undefined) return <Loading />;
  if (session === null) return <Screen><Muted>Game not found.</Muted><ErrorText message={error} /></Screen>;
  if (session.status !== 'active') return <Screen><Muted>This game has finished.</Muted></Screen>;

  const players = session.players;
  const playerIds = players.map((p) => p.id);
  const readyToPay = result === 'win' && !!winnerId && score.valid && (winType === 'selfDraw' || !!discarderId);
  const payments: Record<string, number> | null = readyToPay
    ? calculatePayments({
        playerIds,
        winnerId: winnerId!,
        winType,
        discarderId: winType === 'discard' ? discarderId : null,
        payout: score.payout,
        payment: ruleset.payment,
      })
    : result === 'falseWin' && offenderId
      ? falseWinPayments(playerIds, offenderId, ruleset.payment)
      : null;
  const penalty = falseWinPenalty(ruleset.payment);

  const canSave = result === 'draw' || payments !== null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const none = { winType: null, winnerId: null, discarderId: null, offenderId: null, patterns: [], tai: 0 };
      await recordHand(
        session,
        result === 'draw'
          ? { ...none, result: 'draw', payout: 0, payments: {} }
          : result === 'falseWin'
            ? { ...none, result: 'falseWin', offenderId, payout: penalty, payments: payments! }
            : {
                result: 'win',
                winType,
                winnerId,
                discarderId: winType === 'discard' ? discarderId : null,
                offenderId: null,
                patterns: claimed,
                tai: score.tai,
                payout: score.payout,
                payments: payments!,
              },
        user.uid,
      );
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Row>
        <Chip label="Someone won" selected={result === 'win'} onPress={() => setResult('win')} />
        <Chip label="Draw" selected={result === 'draw'} onPress={() => setResult('draw')} />
        <Chip label="False win 詐胡" selected={result === 'falseWin'} onPress={() => setResult('falseWin')} />
      </Row>

      {result === 'draw' ? (
        <Muted>
          No one wins and no points change.{' '}
          {ruleset.rotation.dealerStaysOnDraw ? 'The dealer keeps the deal.' : 'The deal moves on.'}
        </Muted>
      ) : result === 'falseWin' ? (
        <>
          <Card>
            <SectionTitle>Who declared the false win?</SectionTitle>
            <Row>
              {players.map((p) => (
                <Chip key={p.id} label={`${p.avatar} ${p.name}`} selected={offenderId === p.id} onPress={() => setOffenderId(p.id)} />
              ))}
            </Row>
            <Muted>
              They pay each other player {penalty} (a {ruleset.payment.falseWinTai}-tai hand). The hand is then replayed, and the
              deal doesn’t move.
            </Muted>
          </Card>
          <Card style={styles.summary}>
            <Text style={styles.summaryTai}>Penalty, {penalty} each</Text>
            {payments ? <PaymentList players={players} payments={payments} /> : <Muted>Choose who declared it.</Muted>}
          </Card>
        </>
      ) : (
        <>
          <Card>
            <SectionTitle>Winner</SectionTitle>
            <Row>
              {players.map((p) => (
                <Chip
                  key={p.id}
                  label={`${p.avatar} ${p.name}`}
                  selected={winnerId === p.id}
                  onPress={() => {
                    setWinnerId(p.id);
                    if (discarderId === p.id) setDiscarderId(null);
                  }}
                />
              ))}
            </Row>
            <Row>
              <Chip label="Off a discard" selected={winType === 'discard'} onPress={() => setWinType('discard')} />
              <Chip label="Self-drawn" selected={winType === 'selfDraw'} onPress={() => setWinType('selfDraw')} />
            </Row>
            {winType === 'discard' ? (
              <>
                <Muted>Who discarded the winning tile?</Muted>
                <Row>
                  {players
                    .filter((p) => p.id !== winnerId)
                    .map((p) => (
                      <Chip
                        key={p.id}
                        label={`${p.avatar} ${p.name}`}
                        selected={discarderId === p.id}
                        onPress={() => setDiscarderId(p.id)}
                      />
                    ))}
                </Row>
              </>
            ) : null}
          </Card>

          {GROUP_ORDER.map((group) => {
            const patterns = ruleset.patterns.filter((p) => p.group === group);
            if (patterns.length === 0) return null;
            return (
              <Card key={group}>
                <SectionTitle>{PATTERN_GROUP_NAMES[group]}</SectionTitle>
                {patterns.map((p) => {
                  const count = counts[p.id] ?? 0;
                  const blocker = count === 0 ? blockedBy(ruleset, claimed, p.id) : null;
                  const problem = count === 0 ? contextProblem(p, context) : null;
                  const disabled = !!blocker || !!problem;
                  const max = p.maxCount ?? 1;
                  const { max: allowed, cappedBy } = maxCountFor(ruleset, claimed, p.id);
                  const setCount = (c: number) => setCounts({ ...counts, [p.id]: c });
                  return (
                    <View key={p.id} style={[styles.pattern, disabled && { opacity: 0.45 }]}>
                      <View style={styles.patternText}>
                        <Text style={styles.patternName}>
                          {p.name}
                          {p.chinese ? `  ${p.chinese}` : ''}
                        </Text>
                        <Muted>
                          {p.limit ? `Max (${ruleset.payment.maxTai} tai)` : `${p.tai} tai${max > 1 ? ' each' : ''}`}
                          {blocker
                            ? `. Can’t combine with ${blocker.name}`
                            : problem
                              ? `. ${problem}`
                              : cappedBy
                                ? `. Up to ${allowed} with ${cappedBy.name}`
                                : p.description
                                  ? `. ${p.description}`
                                  : ''}
                        </Muted>
                      </View>
                      {max > 1 ? (
                        <Stepper value={count} max={allowed} onChange={setCount} disabled={disabled} label={p.name} />
                      ) : (
                        <Chip label={count ? 'Added' : 'Add'} selected={count > 0} disabled={disabled} onPress={() => setCount(count ? 0 : 1)} />
                      )}
                    </View>
                  );
                })}
              </Card>
            );
          })}

          <Card style={styles.summary}>
            <Text style={styles.summaryTai}>
              {score.isLimit ? `Limit hand, ${score.tai} tai` : `${score.tai} tai`}
              {score.capped ? ` (capped from ${score.rawTai})` : ''}
            </Text>
            {!score.valid && claimed.length > 0
              ? score.errors.map((e) => <ErrorText key={e} message={e} />)
              : null}
            {!winnerId ? <Muted>Choose the winner.</Muted> : null}
            {winnerId && winType === 'discard' && !discarderId ? <Muted>Choose who discarded.</Muted> : null}
            {payments ? <PaymentList players={players} payments={payments} /> : null}
          </Card>
        </>
      )}

      <ErrorText message={error} />
      <Button title="Save hand" onPress={save} disabled={!canSave} loading={saving} />
    </Screen>
  );
}

function PaymentList({ players, payments }: { players: Player[]; payments: Record<string, number> }) {
  return (
    <>
      {players.map((p) => (
        <View key={p.id} style={styles.payment}>
          <Text style={styles.paymentName}>{p.name}</Text>
          <Text style={[styles.paymentValue, { color: payments[p.id] > 0 ? colors.gain : payments[p.id] < 0 ? colors.loss : colors.text }]}>
            {formatPoints(payments[p.id])}
          </Text>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  pattern: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  patternText: { flex: 1, gap: 2 },
  patternName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  summary: { backgroundColor: colors.feltDeep, borderRadius: radius.card },
  summaryTai: { color: colors.ivory, fontSize: 24, fontWeight: '700' },
  payment: { flexDirection: 'row', justifyContent: 'space-between' },
  paymentName: { color: colors.text, fontSize: 16 },
  paymentValue: { fontSize: 16, fontWeight: '700' },
});
