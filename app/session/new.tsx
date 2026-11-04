import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Protected, useSignedInUser } from '../../src/auth';
import { SeatPicker } from '../../src/components/SeatPicker';
import { createSession, subscribeGroup } from '../../src/db';
import { usePreferredRuleset } from '../../src/preferences';
import { defaultOptions, GameOptions, getRuleset, PaymentRules, RiichiOptions, RULESETS, taiToPayout, unitOf } from '../../src/scoring';
import { colors } from '../../src/theme';
import type { Group, Player } from '../../src/types';
import { Button, Card, Chip, ErrorText, Field, Loading, Muted, Row, Screen, SectionTitle } from '../../src/ui';

export default function NewSession() {
  return (
    <Protected>
      <NewSessionScreen />
    </Protected>
  );
}

function NewSessionScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const user = useSignedInUser();
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [seats, setSeats] = useState<(Player | null)[]>([null, null, null, null]);
  const [guestName, setGuestName] = useState('');
  const [preferredRuleset] = usePreferredRuleset();
  const [chosenRuleset, setRulesetId] = useState<string | null>(null);
  const rulesetId = chosenRuleset ?? preferredRuleset;
  const [overrides, setOverrides] = useState<Partial<GameOptions>>({});
  const [riichiOverrides, setRiichiOverrides] = useState<Partial<RiichiOptions>>({});
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeGroup(groupId, setGroup, (e) => { setError(e.message); setGroup(null); }), [groupId]);

  if (group === undefined) return <Loading />;
  if (group === null) return <Screen><Muted>Group not found.</Muted><ErrorText message={error} /></Screen>;

  const members: Player[] = group.memberIds.map((uid) => ({
    id: uid,
    uid,
    name: group.members?.[uid]?.name ?? 'Player',
    avatar: group.members?.[uid]?.avatar ?? '🀄',
  }));

  const ruleset = getRuleset(rulesetId);
  const base = defaultOptions(ruleset, overrides.players ?? 4);
  // Firestore rejects undefined fields, so house games leave `riichi` out entirely.
  const options: GameOptions = {
    ...base,
    ...overrides,
    ...(base.riichi ? { riichi: { ...base.riichi, ...riichiOverrides } } : {}),
  };
  const setPlayers = (players: 3 | 4) => {
    setOverrides({ ...overrides, players });
    // Starting points, uma and tenpai payments differ with three players, so they go back to the defaults.
    setRiichiOverrides({});
    // The North seat goes away in a three-player game; whoever sat there is unseated.
    setSeats(players === 3 ? seats.slice(0, 3) : [...seats.slice(0, 3), seats[3] ?? null]);
  };

  const seatedIds = new Set(seats.filter(Boolean).map((p) => p!.id));
  const full = seats.every(Boolean);

  const seat = (player: Player) => {
    if (seatedIds.has(player.id)) return;
    const i = seats.findIndex((s) => s === null);
    if (i === -1) return setError(`All ${seats.length} seats are taken. Tap a seat to free it.`);
    setError(null);
    setSeats(seats.map((s, j) => (j === i ? player : s)));
  };

  const addGuest = () => {
    const name = guestName.trim();
    if (!name) return;
    seat({ id: `guest_${Math.random().toString(36).slice(2, 10)}`, uid: null, name, avatar: '🙂' });
    setGuestName('');
  };

  const shuffle = () => {
    const next = [...seats];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setSeats(next);
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await createSession(group, seats as Player[], rulesetId, options, user.uid);
      router.replace(`/session/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Screen scrollEnabled={!dragging}>
      <SectionTitle>Seats</SectionTitle>
      <Muted>East deals first. Hold a player and drag them onto another seat to swap. Tap a seat to free it.</Muted>
      <View style={styles.seats}>
        <SeatPicker seats={seats} onChange={setSeats} onDragging={setDragging} />
      </View>
      <Button title="Shuffle seats" variant="secondary" onPress={shuffle} disabled={!seats.some(Boolean)} />

      <Card>
        <SectionTitle>Group members</SectionTitle>
        <Row>
          {members.map((m) => (
            <Chip key={m.id} label={`${m.avatar} ${m.name}`} selected={seatedIds.has(m.id)} onPress={() => seat(m)} />
          ))}
        </Row>
        <Field
          label="Add a guest"
          value={guestName}
          onChangeText={setGuestName}
          placeholder="Name of someone without an account"
          onSubmitEditing={addGuest}
        />
        <Button title="Add guest" variant="secondary" onPress={addGuest} disabled={!guestName.trim()} />
        <Muted>Guests’ scores count in this game, but they don’t get career stats.</Muted>
      </Card>

      <Card>
        <SectionTitle>Rules</SectionTitle>
        <Row>
          {RULESETS.map((r) => (
            <Chip key={r.id} label={r.name} selected={rulesetId === r.id} onPress={() => setRulesetId(r.id)} />
          ))}
        </Row>
        <Muted>{ruleset.description}</Muted>
      </Card>

      <Card>
        <SectionTitle>Settings for this game</SectionTitle>
        <Text style={styles.label}>Players</Text>
        <Row>
          <Chip label="4 players" selected={options.players === 4} onPress={() => setPlayers(4)} />
          <Chip label="3 players" selected={options.players === 3} onPress={() => setPlayers(3)} />
        </Row>
        {ruleset.scoringModel === 'hanFu' ? (
          <RiichiSettings
            options={options.riichi!}
            players={options.players}
            onChange={(r) => setRiichiOverrides({ ...riichiOverrides, ...r })}
          />
        ) : (
          <HouseSettings
            options={options}
            payment={ruleset.payment}
            unit={unitOf(ruleset)}
            onChange={(o) => setOverrides({ ...overrides, ...o })}
          />
        )}
      </Card>

      <ErrorText message={error} />
      <Button title={full ? 'Start game' : `Fill all ${seats.length} seats to start`} onPress={start} disabled={!full} loading={busy} />
    </Screen>
  );
}

const MIN_TAI_CHOICES = [0, 1, 2, 3];
const MAX_TAI_CHOICES = [3, 4, 5, 6, 8, 10];
const UMA_CHOICES: Record<3 | 4, number[][]> = {
  4: [
    [15, 5, -5, -15],
    [20, 10, -10, -20],
    [30, 10, -10, -30],
  ],
  3: [
    [20, 0, -20],
    [10, 0, -10],
  ],
};
const formatUma = (uma: number[]) => uma.map((u) => (u > 0 ? `+${u}` : `${u}`)).join(' / ');

function HouseSettings({
  options,
  payment,
  unit,
  onChange,
}: {
  options: GameOptions;
  payment: PaymentRules;
  unit: string;
  onChange: (o: Partial<GameOptions>) => void;
}) {
  return (
    <>
      <Text style={styles.label}>Min {unit} to win</Text>
      <Row>
        {[...new Set([...MIN_TAI_CHOICES, payment.minTai])]
          .filter((t) => t <= options.maxTai)
          .sort((a, b) => a - b)
          .map((t) => (
            <Chip key={t} label={`${t}`} selected={options.minTai === t} onPress={() => onChange({ minTai: t })} />
          ))}
      </Row>
      <Text style={styles.label}>Max {unit}</Text>
      <Row>
        {[...new Set([...MAX_TAI_CHOICES, payment.maxTai])]
          .filter((t) => t >= options.minTai)
          .sort((a, b) => a - b)
          .map((t) => (
            <Chip key={t} label={`${t}`} selected={options.maxTai === t} onPress={() => onChange({ maxTai: t })} />
          ))}
      </Row>
      <Muted>
        A hand needs at least {options.minTai} {unit} to win. {payment.payoutCapOnly ? 'Payouts are' : 'Hands are'} capped at{' '}
        {options.maxTai} {unit}, and limit hands score {payment.limitTai ?? options.maxTai}. The most a hand pays is{' '}
        {taiToPayout(options.maxTai, { ...payment, maxTai: options.maxTai }).toLocaleString()} per player.
      </Muted>
      {options.players === 3 ? <Muted>No North seat. The deal goes round three players, so a full game is 12 hands.</Muted> : null}

      <Text style={styles.label}>Winning off a discard</Text>
      <Row>
        <Chip label="Shooter pays double" selected={options.discard === 'shooterDouble'} onPress={() => onChange({ discard: 'shooterDouble' })} />
        <Chip
          label="Shooter pays for the table"
          selected={options.discard === 'shooterOnly'}
          onPress={() => onChange({ discard: 'shooterOnly' })}
        />
      </Row>
      <Muted>
        {options.discard === 'shooterOnly'
          ? `The discarder pays everyone’s share (${options.players} on a 1-${unit} hand), so the winner gets the same as usual.`
          : 'The discarder pays double, and everyone else pays single.'}
      </Muted>
    </>
  );
}

function RiichiSettings({
  options: r,
  players,
  onChange,
}: {
  options: RiichiOptions;
  players: 3 | 4;
  onChange: (r: Partial<RiichiOptions>) => void;
}) {
  const choice = (label: string, on: boolean, set: (v: boolean) => void, onText: string, offText: string) => (
    <>
      <Text style={styles.label}>{label}</Text>
      <Row>
        <Chip label={onText} selected={on} onPress={() => set(true)} />
        <Chip label={offText} selected={!on} onPress={() => set(false)} />
      </Row>
    </>
  );
  return (
    <>
      <Muted>
        Everyone starts on {r.startingPoints.toLocaleString()}, with {r.returnPoints.toLocaleString()} return points.
        {players === 3 ? ' No North seat or chii; North tiles are set aside as dora.' : ''}
      </Muted>
      {choice('Game length', r.gameLength === 'hanchan', (v) => onChange({ gameLength: v ? 'hanchan' : 'tonpuusen' }), 'Hanchan (East and South)', 'East round only')}
      <Text style={styles.label}>Uma</Text>
      <Row>
        {UMA_CHOICES[players].map((u) => (
          <Chip key={u.join()} label={formatUma(u)} selected={r.uma.join() === u.join()} onPress={() => onChange({ uma: u })} />
        ))}
      </Row>
      {choice('Two players ron the same tile', r.multipleRon === 'double', (v) => onChange({ multipleRon: v ? 'double' : 'atamahane' }), 'Double ron', 'Head bump (nearest only)')}
      {choice('Below zero points', r.busting, (v) => onChange({ busting: v }), 'Ends the game', 'Play on')}
      {choice('4 han 30 fu and 3 han 60 fu', r.kiriageMangan, (v) => onChange({ kiriageMangan: v }), 'Round up to mangan', 'Score as is')}
      {choice('13+ han', r.kazoeYakuman, (v) => onChange({ kazoeYakuman: v }), 'Kazoe yakuman', 'Cap at sanbaiman')}
      {players === 3
        ? choice('Tsumo with three players', r.tsumoLoss, (v) => onChange({ tsumoLoss: v }), 'Tsumo loss', 'Split the full value')
        : null}
    </>
  );
}

const styles = StyleSheet.create({
  seats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  label: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
