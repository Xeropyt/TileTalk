import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { recordHand } from '../db';
import {
  FU_CHOICES,
  handValue,
  limitName,
  MANGAN_HAN,
  RiichiHandEntry,
  riichiOptionsOf,
  RiichiWinner,
  rulesetFor,
  settleRiichiHand,
} from '../scoring';
import { colors, radius } from '../theme';
import type { Player, Session } from '../types';
import { Button, Card, Chip, ErrorText, formatPoints, Muted, Row, Screen, SectionTitle } from '../ui';

type Kind = RiichiHandEntry['kind'];
const HAN_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const newWinner = (): Partial<RiichiWinner> => ({ han: 1, fu: 30, yakuman: 0 });

/** Records a Riichi hand from han and fu. The app works out every payment from there. */
export function RiichiHandForm({ session, uid }: { session: Session; uid: string }) {
  const ruleset = rulesetFor(session.rulesetId, session.options);
  const players = session.players;
  const playerIds = players.map((p) => p.id);
  const opts = riichiOptionsOf(ruleset, session.options, players.length);
  const dealerId = players[session.table.dealerIndex].id;
  const honba = session.table.honba ?? 0;
  const sticks = session.table.riichiSticks ?? 0;

  const [kind, setKind] = useState<Kind>('win');
  const [tsumo, setTsumo] = useState(false);
  const [discarderId, setDiscarderId] = useState<string | null>(null);
  const [winners, setWinners] = useState<Partial<RiichiWinner>[]>([newWinner()]);
  const [declarers, setDeclarers] = useState<string[]>([]);
  const [tenpai, setTenpai] = useState<string[]>([]);
  const [nagashiId, setNagashiId] = useState<string | null>(null);
  const [offenderId, setOffenderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOf = (id: string | null | undefined) => players.find((p) => p.id === id)?.name ?? 'Someone';
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const updateWinner = (i: number, w: Partial<RiichiWinner>) => setWinners(winners.map((x, j) => (j === i ? { ...x, ...w } : x)));

  // Build the entry if it's complete; null otherwise.
  const entry: RiichiHandEntry | null = (() => {
    if (kind === 'chombo') return offenderId ? { kind, offenderId } : null;
    if (kind === 'abortive') return { kind, declarers };
    if (kind === 'exhaustive') return { kind, tenpai, declarers, nagashiId };
    const ws = (tsumo ? winners.slice(0, 1) : winners) as RiichiWinner[];
    if (!tsumo && !discarderId) return null;
    if (ws.some((w) => !w.playerId || w.playerId === discarderId)) return null;
    if (new Set(ws.map((w) => w.playerId)).size !== ws.length) return null;
    return { kind: 'win', discarderId: tsumo ? null : discarderId, winners: ws, declarers };
  })();
  const settled = entry ? settleRiichiHand(entry, { playerIds, dealerId, honba, sticks, opts }) : null;

  const save = async () => {
    if (!entry || !settled) return;
    setSaving(true);
    setError(null);
    const main = settled.mainWinnerId;
    const mainWinner = entry.kind === 'win' ? entry.winners.find((w) => w.playerId === main) : undefined;
    try {
      await recordHand(
        session,
        {
          result: entry.kind === 'win' ? 'win' : entry.kind === 'chombo' ? 'falseWin' : 'draw',
          winType: entry.kind === 'win' ? (entry.discarderId ? 'discard' : 'selfDraw') : null,
          winnerId: main,
          discarderId: entry.kind === 'win' ? entry.discarderId : null,
          offenderId: entry.kind === 'chombo' ? entry.offenderId : null,
          patterns: [],
          tai: mainWinner ? handValue(mainWinner.han, mainWinner.yakuman) : 0,
          payout: main ? settled.payments[main] : 0,
          payments: settled.payments,
          riichi: {
            declarers: entry.kind === 'chombo' ? [] : entry.declarers,
            winners: entry.kind === 'win' ? entry.winners.map((w, i) => ({ ...w, base: settled.bases[i] })) : [],
            drawType: entry.kind === 'exhaustive' || entry.kind === 'abortive' ? entry.kind : null,
            tenpai: entry.kind === 'exhaustive' ? entry.tenpai : [],
            nagashiId: entry.kind === 'exhaustive' ? entry.nagashiId : null,
            honba,
            sticksBefore: sticks,
            sticksAfter: settled.sticksAfter,
            outcome: settled.outcome,
          },
        },
        uid,
      );
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const playerChips = (selected: (id: string) => boolean, onPress: (id: string) => void, exclude: string[] = []) => (
    <Row>
      {players
        .filter((p) => !exclude.includes(p.id))
        .map((p) => (
          <Chip key={p.id} label={`${p.avatar} ${p.name}`} selected={selected(p.id)} onPress={() => onPress(p.id)} />
        ))}
    </Row>
  );

  return (
    <Screen>
      <Row>
        <Chip label="Win" selected={kind === 'win'} onPress={() => setKind('win')} />
        <Chip label="Exhaustive draw" selected={kind === 'exhaustive'} onPress={() => setKind('exhaustive')} />
        <Chip label="Abortive draw" selected={kind === 'abortive'} onPress={() => setKind('abortive')} />
        <Chip label="Chombo" selected={kind === 'chombo'} onPress={() => setKind('chombo')} />
      </Row>
      <Muted>
        {honba} honba, {sticks} {sticks === 1 ? 'stick' : 'sticks'} on the table. {nameOf(dealerId)} is dealing.
      </Muted>

      {kind !== 'chombo' ? (
        <Card>
          <SectionTitle>Who declared riichi?</SectionTitle>
          {playerChips((id) => declarers.includes(id), (id) => setDeclarers(toggle(declarers, id)))}
          <Muted>Each puts a 1,000 stick on the table. Leave out anyone whose riichi discard was ronned.</Muted>
        </Card>
      ) : null}

      {kind === 'win' ? (
        <>
          <Card>
            <Row>
              <Chip label="Ron" selected={!tsumo} onPress={() => setTsumo(false)} />
              <Chip label="Tsumo" selected={tsumo} onPress={() => setTsumo(true)} />
            </Row>
            {!tsumo ? (
              <>
                <Text style={styles.label}>Who discarded?</Text>
                {playerChips((id) => discarderId === id, setDiscarderId)}
              </>
            ) : null}
          </Card>

          {(tsumo ? winners.slice(0, 1) : winners).map((w, i) => (
            <WinnerCard
              key={i}
              title={winners.length > 1 && !tsumo ? `Winner ${i + 1}` : 'Winner'}
              players={players}
              exclude={[...(tsumo ? [] : [discarderId ?? '']), ...winners.filter((_, j) => j !== i).map((x) => x.playerId ?? '')]}
              winner={w}
              onChange={(x) => updateWinner(i, x)}
              base={settled?.bases[i]}
              onRemove={i > 0 ? () => setWinners(winners.slice(0, 1)) : undefined}
            />
          ))}
          {!tsumo && winners.length === 1 && opts.multipleRon === 'double' && players.length > 2 ? (
            <Button title="Add a second winner (double ron)" variant="secondary" onPress={() => setWinners([...winners, newWinner()])} />
          ) : null}
        </>
      ) : null}

      {kind === 'exhaustive' ? (
        <Card>
          <SectionTitle>Who was tenpai?</SectionTitle>
          {playerChips((id) => tenpai.includes(id), (id) => setTenpai(toggle(tenpai, id)))}
          <Muted>
            Noten players pay tenpai players {opts.tenpaiPayment.toLocaleString()} between them. The dealer keeps the deal only if
            tenpai.
          </Muted>
          {opts.nagashiMangan ? (
            <>
              <Text style={styles.label}>Nagashi mangan?</Text>
              <Row>
                <Chip label="No" selected={!nagashiId} onPress={() => setNagashiId(null)} />
                {players.map((p) => (
                  <Chip key={p.id} label={p.name} selected={nagashiId === p.id} onPress={() => setNagashiId(p.id)} />
                ))}
              </Row>
              <Muted>Every discard a terminal or honour, none called. Paid as a mangan tsumo instead of tenpai payments.</Muted>
            </>
          ) : null}
        </Card>
      ) : null}

      {kind === 'abortive' ? (
        <Muted>Nine terminals, four winds, four riichi or four kans. No points change, and the hand is replayed with one more honba.</Muted>
      ) : null}

      {kind === 'chombo' ? (
        <Card>
          <SectionTitle>Who made the chombo?</SectionTitle>
          {playerChips((id) => offenderId === id, setOffenderId)}
          <Muted>They pay a reverse mangan and the hand is replayed. Riichi sticks from this hand go back.</Muted>
        </Card>
      ) : null}

      <Card style={styles.summary}>
        {settled ? (
          players.map((p) => (
            <View key={p.id} style={styles.payment}>
              <Text style={styles.paymentName}>{p.name}</Text>
              <Text
                style={[
                  styles.paymentValue,
                  { color: settled.payments[p.id] > 0 ? colors.gain : settled.payments[p.id] < 0 ? colors.loss : colors.text },
                ]}
              >
                {formatPoints(settled.payments[p.id])}
              </Text>
            </View>
          ))
        ) : (
          <Muted>Fill in the hand to see the payments.</Muted>
        )}
        {settled && settled.sticksAfter > 0 ? <Muted>{settled.sticksAfter} riichi sticks carry over.</Muted> : null}
      </Card>

      <ErrorText message={error} />
      <Button title="Save hand" onPress={save} disabled={!settled} loading={saving} />
    </Screen>
  );
}

function WinnerCard({
  title,
  players,
  exclude,
  winner: w,
  onChange,
  base,
  onRemove,
}: {
  title: string;
  players: Player[];
  exclude: string[];
  winner: Partial<RiichiWinner>;
  onChange: (w: Partial<RiichiWinner>) => void;
  base?: number;
  onRemove?: () => void;
}) {
  const needsFu = !w.yakuman && (w.han ?? 1) < MANGAN_HAN;
  const label = base ? limitName(base) ?? `${w.han} han ${w.fu} fu` : null;
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      <Row>
        {players
          .filter((p) => !exclude.includes(p.id))
          .map((p) => (
            <Chip key={p.id} label={`${p.avatar} ${p.name}`} selected={w.playerId === p.id} onPress={() => onChange({ playerId: p.id })} />
          ))}
      </Row>
      <Text style={styles.label}>Yakuman</Text>
      <Row>
        <Chip label="No" selected={!w.yakuman} onPress={() => onChange({ yakuman: 0 })} />
        <Chip label="Yakuman" selected={w.yakuman === 1} onPress={() => onChange({ yakuman: 1 })} />
        <Chip label="Double" selected={w.yakuman === 2} onPress={() => onChange({ yakuman: 2 })} />
      </Row>
      {!w.yakuman ? (
        <>
          <Text style={styles.label}>Han (yaku plus dora)</Text>
          <Row>
            {HAN_CHOICES.map((h) => (
              <Chip key={h} label={h === 13 ? '13+' : `${h}`} selected={w.han === h} onPress={() => onChange({ han: h })} />
            ))}
          </Row>
        </>
      ) : null}
      {needsFu ? (
        <>
          <Text style={styles.label}>Fu</Text>
          <Row>
            {FU_CHOICES.map((f) => (
              <Chip key={f} label={`${f}`} selected={w.fu === f} onPress={() => onChange({ fu: f })} />
            ))}
          </Row>
          <Muted>Pinfu tsumo 20, seven pairs 25, most ron hands 30 or 40.</Muted>
        </>
      ) : null}
      {label ? <Text style={styles.value}>{label}</Text> : null}
      {onRemove ? <Button title="Remove this winner" variant="secondary" onPress={onRemove} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  value: { color: colors.ivory, fontSize: 18, fontWeight: '700' },
  summary: { backgroundColor: colors.feltDeep, borderRadius: radius.card },
  payment: { flexDirection: 'row', justifyContent: 'space-between' },
  paymentName: { color: colors.text, fontSize: 16 },
  paymentValue: { fontSize: 16, fontWeight: '700' },
});
