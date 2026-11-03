import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { recordPayout, undoPayout } from '../db';
import { seatWindOf, WIND_NAMES } from '../game/winds';
import { immediatePayments, ImmediatePayoutDef, rulesetFor } from '../scoring';
import { colors, radius } from '../theme';
import type { PayoutRecord, Session } from '../types';
import { Button, Card, Chip, ErrorText, formatPoints, Muted, Row, SectionTitle } from '../ui';

/** Buttons for kongs, flower kongs and the like, which are paid the moment they happen. */
export function PayoutsCard({ session, uid }: { session: Session; uid: string }) {
  const ruleset = rulesetFor(session.rulesetId, session.options);
  const others = session.players.length - 1;
  const defs = ruleset.immediatePayouts;
  const active = session.status === 'active';
  const [type, setType] = useState<ImmediatePayoutDef | null>(null);
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [payerId, setPayerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const payouts = [...(session.payouts ?? [])].reverse();
  if (defs.length === 0 || (!active && payouts.length === 0)) return null;

  const nameOf = (pid: string | null) => session.players.find((p) => p.id === pid)?.name ?? 'Someone';
  const playerIds = session.players.map((p) => p.id);
  const ready = !!type && !!receiverId && (type.payer === 'others' || !!payerId);
  const reset = () => {
    setType(null);
    setReceiverId(null);
    setPayerId(null);
  };

  const record = async () => {
    if (!type || !receiverId) return;
    setBusy(true);
    setError(null);
    try {
      const payments = immediatePayments(type, playerIds, receiverId, payerId);
      await recordPayout(session, { type: type.id, receiverId, payerId: type.payer === 'others' ? null : payerId, payments }, uid);
      reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const undo = async (p: PayoutRecord) => {
    if (confirmUndo !== p.id) return setConfirmUndo(p.id);
    setConfirmUndo(null);
    setError(null);
    try {
      await undoPayout(session.id, p.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const preview = () => {
    if (!type) return '';
    const all = `Each other player pays ${type.amount}${receiverId ? `, so ${nameOf(receiverId)} gets ${type.amount * others}` : ''}.`;
    if (type.payer === 'others') return all;
    if (type.payer === 'discarder') return `The discarder pays ${type.amount}.`;
    if (payerId && payerId === receiverId) return `Their own seat: ${all.charAt(0).toLowerCase()}${all.slice(1)}`;
    return payerId ? `${nameOf(payerId)} pays ${type.amount}.` : `Whoever’s seat it is pays ${type.amount}. If it’s their own, everyone pays.`;
  };

  const describe = (p: PayoutRecord) => {
    const def = defs.find((d) => d.id === p.type);
    const from = !p.payerId ? '' : p.payerId === p.receiverId ? ', own seat' : ` off ${nameOf(p.payerId)}`;
    return `${nameOf(p.receiverId)}: ${def?.name ?? 'Payout'}${def?.chinese ? ` ${def.chinese}` : ''}${from}, ${formatPoints(p.payments[p.receiverId] ?? 0)}`;
  };

  return (
    <Card>
      <SectionTitle>Immediate payouts</SectionTitle>
      {active ? (
        <>
          <Muted>Tap one the moment it happens. It’s paid straight away, whoever wins the hand.</Muted>
          <Row>
            {defs.map((d) => (
              <Chip
                key={d.id}
                label={`${d.name}${d.chinese ? ` ${d.chinese}` : ''}`}
                selected={type?.id === d.id}
                onPress={() => {
                  if (type?.id === d.id) return reset();
                  setType(d);
                  setPayerId(null);
                }}
              />
            ))}
          </Row>
        </>
      ) : null}

      {active && type ? (
        <View style={styles.form}>
          <Text style={styles.label}>Who got it?</Text>
          <Row>
            {session.players.map((p) => (
              <Chip
                key={p.id}
                label={`${p.avatar} ${p.name}`}
                selected={receiverId === p.id}
                onPress={() => {
                  setReceiverId(p.id);
                  if (type.payer === 'discarder' && payerId === p.id) setPayerId(null);
                }}
              />
            ))}
          </Row>
          {type.payer === 'discarder' ? (
            <>
              <Text style={styles.label}>Who discarded the tile?</Text>
              <Row>
                {session.players
                  .filter((p) => p.id !== receiverId)
                  .map((p) => (
                    <Chip key={p.id} label={`${p.avatar} ${p.name}`} selected={payerId === p.id} onPress={() => setPayerId(p.id)} />
                  ))}
              </Row>
            </>
          ) : null}
          {type.payer === 'owner' ? (
            <>
              <Text style={styles.label}>Whose seat is it?</Text>
              <Row>
                {session.players.map((p, i) => {
                  const wind = seatWindOf(i, session.table.dealerIndex, session.players.length);
                  return (
                    <Chip
                      key={p.id}
                      label={`${p.name}: ${WIND_NAMES[wind]} ${wind + 1}${p.id === receiverId ? ' (own)' : ''}`}
                      selected={payerId === p.id}
                      onPress={() => setPayerId(p.id)}
                    />
                  );
                })}
              </Row>
            </>
          ) : null}
          <Muted>{preview()}</Muted>
          <Button title="Record payout" onPress={record} disabled={!ready} loading={busy} />
          <Button title="Cancel" variant="secondary" onPress={reset} />
        </View>
      ) : null}

      <ErrorText message={error} />

      {payouts.length > 0 ? (
        <View style={styles.list}>
          {payouts.map((p) => {
            // Once the hand is recorded its payouts are part of history, so only this hand's can be undone.
            const undoable = active && p.handNumber === session.table.handNumber;
            return (
              <View key={p.id} style={styles.item}>
                <View style={styles.itemText}>
                  <Text style={styles.itemTitle}>{describe(p)}</Text>
                  <Muted>Hand {p.handNumber}</Muted>
                </View>
                {undoable ? (
                  <Chip label={confirmUndo === p.id ? 'Tap to undo' : 'Undo'} selected={confirmUndo === p.id} onPress={() => undo(p)} />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.feltLine },
  label: { color: colors.muted, fontSize: 13, fontWeight: '600', paddingTop: 6 },
  list: { gap: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.feltDeep,
    borderRadius: radius.control,
    padding: 10,
  },
  itemText: { flex: 1, gap: 2 },
  itemTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
