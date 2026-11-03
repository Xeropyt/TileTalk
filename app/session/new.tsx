import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Protected, useSignedInUser } from '../../src/auth';
import { createSession, subscribeGroup } from '../../src/db';
import { WIND_CHARS, WIND_NAMES } from '../../src/game/winds';
import { usePreferredRuleset } from '../../src/preferences';
import { RULESETS } from '../../src/scoring';
import { colors, radius } from '../../src/theme';
import type { Group, Player } from '../../src/types';
import { Button, Card, Chip, ErrorText, Field, Loading, Muted, Row, Screen, SectionTitle, Tile } from '../../src/ui';

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
  const [busy, setBusy] = useState(false);
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

  const seatedIds = new Set(seats.filter(Boolean).map((p) => p!.id));
  const full = seats.every(Boolean);

  const seat = (player: Player) => {
    if (seatedIds.has(player.id)) return;
    const i = seats.findIndex((s) => s === null);
    if (i === -1) return setError('All four seats are taken. Tap a seat to free it.');
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
      const id = await createSession(group, seats as Player[], rulesetId, user.uid);
      router.replace(`/session/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Screen>
      <SectionTitle>Seats</SectionTitle>
      <Muted>East deals first. Tap a seat to free it.</Muted>
      <View style={styles.seats}>
        {seats.map((p, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={p ? `${WIND_NAMES[i]} seat: ${p.name}. Tap to remove.` : `${WIND_NAMES[i]} seat, empty`}
            onPress={() => setSeats(seats.map((s, j) => (j === i ? null : s)))}
            style={[styles.seat, !p && styles.seatEmpty]}
          >
            <Tile char={WIND_CHARS[i]} size={30} />
            <Text style={styles.seatText} numberOfLines={1}>
              {p ? `${p.avatar} ${p.name}` : 'Empty'}
            </Text>
          </Pressable>
        ))}
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
        <Muted>{RULESETS.find((r) => r.id === rulesetId)?.description}</Muted>
      </Card>

      <ErrorText message={error} />
      <Button title={full ? 'Start game' : 'Fill all four seats to start'} onPress={start} disabled={!full} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  seats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  seat: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radius.card,
    backgroundColor: colors.feltRaised,
    borderWidth: 1,
    borderColor: colors.feltLine,
  },
  seatEmpty: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  seatText: { color: colors.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
});
