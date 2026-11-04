import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Protected, useSignedInUser } from '../../../src/auth';
import { RiichiHandForm } from '../../../src/components/RiichiHandForm';
import { TilePicker } from '../../../src/components/TilePicker';
import { recordHand, subscribeSession } from '../../../src/db';
import { handName } from '../../../src/game/history';
import { seatWindOf } from '../../../src/game/winds';
import {
  blockedBy,
  calculatePayments,
  ClaimedPattern,
  contextProblem,
  falseWinPayments,
  falseWinPenalty,
  findPattern,
  HandContext,
  HONG_KONG_ID,
  hongKongConfigFor,
  maxCountFor,
  PATTERN_GROUP_NAMES,
  PatternGroup,
  readTiles,
  rulesetFor,
  scoreHand,
  scoreHongKong,
  unitOf,
  TileReading,
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
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const user = useSignedInUser();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [result, setResult] = useState<HandResult>('win');
  const [offenderId, setOffenderId] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [winType, setWinType] = useState<WinType>('discard');
  const [discarderId, setDiscarderId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  // The tile calculator: lay out the winning tiles and the patterns they show fill themselves in.
  const [byTiles, setByTiles] = useState(mode === 'tiles');
  const [tiles, setTiles] = useState<string[]>([]);
  const [flowers, setFlowers] = useState<string[]>([]);
  // Hong Kong: whether any set was melded (claimed from a discard), which the tiles can't show.
  const [melded, setMelded] = useState(true);
  // Tapping a tile redraws the tiles straight away; reading them and redrawing the patterns
  // follows a moment later, so taps don't wait on it.
  const readTilesFrom = useDeferredValue(tiles);
  const readFlowersFrom = useDeferredValue(flowers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeSession(id, setSession, (e) => { setError(e.message); setSession(null); }), [id]);

  const rulesetId = session?.rulesetId ?? 'house';
  const options = session?.options;
  const ruleset = useMemo(() => rulesetFor(rulesetId, options), [rulesetId, options]);
  const isHongKong = ruleset.id === HONG_KONG_ID;
  const unit = unitOf(ruleset);
  const tileMode = byTiles && ruleset.scoringModel === 'tai';
  const winnerIndex = session && winnerId ? session.players.findIndex((p) => p.id === winnerId) : -1;
  const dealerId = session ? session.players[session.table.dealerIndex]?.id : undefined;
  // Own winds and flowers depend on the winner's seat, so the tiles are read once there's a winner.
  const reading: TileReading | null = useMemo(() => {
    if (!tileMode || !session || winnerIndex < 0) return null;
    const seatWind = seatWindOf(winnerIndex, session.table.dealerIndex, session.players.length);
    const prevailingWind = session.table.prevailingWind;
    if (!isHongKong) return readTiles(ruleset, readTilesFrom, readFlowersFrom, { seatWind, prevailingWind });
    // Hong Kong has its own detector, which also needs how the hand was won.
    const said = (pid: string) => (counts[pid] ?? 0) > 0;
    const hk = scoreHongKong(
      {
        tiles: readTilesFrom,
        flowers: readFlowersFrom,
        winType,
        seatWind,
        prevailingWind,
        isDealer: winnerId === dealerId,
        openHand: melded,
        kongReplacement: said('kong_replacement'),
        robbingKong: said('robbing_kong'),
        lastTile: said('last_tile'),
        heavenly: said('heavenly_hand'),
        earthly: said('earthly_hand'),
      },
      hongKongConfigFor(ruleset.payment),
    );
    return hk.patterns.length
      ? { ok: true, patterns: hk.patterns.map((p) => ({ id: p.id, count: p.count })), decomposition: null }
      : { ok: false, reason: hk.reason ?? 'These tiles don’t make a winning hand.' };
  }, [tileMode, session, winnerIndex, isHongKong, ruleset, readTilesFrom, readFlowersFrom, counts, winType, winnerId, dealerId, melded]);
  const claimed: ClaimedPattern[] = useMemo(() => {
    const picked = Object.entries(counts).filter(([, c]) => c > 0).map(([pid, count]) => ({ id: pid, count }));
    if (!tileMode) return picked;
    const found = reading?.ok ? reading.patterns : [];
    // Hong Kong's detector already counted what the player said about how they won.
    if (isHongKong) return found;
    // In tile mode the tiles decide every pattern they can show; the player adds the rest.
    return [...found, ...picked.filter((c) => !findPattern(ruleset, c.id)?.fromTiles)];
  }, [counts, tileMode, reading, ruleset, isHongKong]);
  const context: HandContext = useMemo(
    () => ({ winType, isDealer: winnerId && dealerId ? winnerId === dealerId : undefined }),
    [winType, winnerId, dealerId],
  );
  const score = useMemo(() => scoreHand(ruleset, claimed, context), [ruleset, claimed, context]);
  // Kept apart so tapping tiles doesn't redraw every pattern row.
  const patternCards = useMemo(
    () =>
      GROUP_ORDER.map((group) => {
        // The calculator already counted patterns the tiles show, so only the rest are asked about.
        const patterns = ruleset.patterns.filter((p) => p.group === group && !(tileMode && p.fromTiles));
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
                      {p.limit
                        ? `Limit (${ruleset.payment.limitTai ?? ruleset.payment.maxTai} ${unit})`
                        : `${p.tai} ${unit}${max > 1 ? ' each' : ''}`}
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
      }),
    [ruleset, counts, claimed, context, tileMode, unit],
  );

  if (session === undefined) return <Loading />;
  if (session === null) return <Screen><Muted>Game not found.</Muted><ErrorText message={error} /></Screen>;
  if (session.status !== 'active') return <Screen><Muted>This game has finished.</Muted></Screen>;
  if (ruleset.scoringModel === 'hanFu') return <RiichiHandForm session={session} uid={user.uid} />;

  const players = session.players;
  const playerIds = players.map((p) => p.id);
  const tilesReady = !tileMode || !!reading?.ok;
  const readyToPay = result === 'win' && !!winnerId && tilesReady && score.valid && (winType === 'selfDraw' || !!discarderId);
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
                ...(tileMode ? { tiles, flowers } : {}),
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
              They pay each other player {penalty}, the game’s max {unit} in points. The hand is then replayed, and the deal
              doesn’t move.
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

          {ruleset.scoringModel === 'tai' ? (
            <Row>
              <Chip label="Pick patterns" selected={!tileMode} onPress={() => setByTiles(false)} />
              <Chip label="Calculate from tiles" selected={tileMode} onPress={() => setByTiles(true)} />
            </Row>
          ) : null}

          {tileMode ? (
            <Card>
              <SectionTitle>Winning tiles</SectionTitle>
              <TilePicker
                tiles={tiles}
                flowers={flowers}
                onChange={(t, f) => {
                  setTiles(t);
                  setFlowers(f);
                }}
                onError={setError}
              />
              {isHongKong ? (
                <Row>
                  <Chip label="Some sets melded" selected={melded} onPress={() => setMelded(true)} />
                  <Chip label="All concealed" selected={!melded} onPress={() => setMelded(false)} />
                </Row>
              ) : null}
              <View style={styles.reading}>
                {!winnerId ? (
                  <Muted>Choose the winner, so their own wind and flowers count.</Muted>
                ) : reading?.ok ? (
                  <>
                    <Text style={styles.readingLabel}>From your tiles</Text>
                    <Text style={styles.readingName}>{handName(ruleset, reading.patterns) ?? 'No scoring patterns in the tiles'}</Text>
                  </>
                ) : reading ? (
                  <Muted>{reading.reason}</Muted>
                ) : null}
              </View>
            </Card>
          ) : null}

          {tileMode ? <SectionTitle>Anything the tiles can’t show?</SectionTitle> : null}
          {patternCards}

          <Card style={styles.summary}>
            <Text style={styles.summaryTai}>
              {score.isLimit ? `Limit hand, ${score.tai} ${unit}` : `${score.tai} ${unit}`}
              {score.capped ? ` (capped from ${score.rawTai})` : ''}
            </Text>
            {score.isLimit && score.tai > ruleset.payment.maxTai ? <Muted>
                Pays as {ruleset.payment.maxTai} {unit}, the game’s max.
              </Muted> : null}
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
  reading: { gap: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.feltLine },
  readingLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  readingName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  payment: { flexDirection: 'row', justifyContent: 'space-between' },
  paymentName: { color: colors.text, fontSize: 16 },
  paymentValue: { fontSize: 16, fontWeight: '700' },
});
