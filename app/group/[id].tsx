import React, { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Protected, useSignedInUser } from '../../src/auth';
import { subscribeGroup, subscribeGroupSessions } from '../../src/db';
import { SessionRow } from '../../src/components/SessionRow';
import { WIND_NAMES } from '../../src/game/winds';
import { colors, radius } from '../../src/theme';
import type { Group, Session } from '../../src/types';
import { Button, Card, ErrorText, Loading, Muted, Row, Screen, SectionTitle, Tile, Title } from '../../src/ui';

export default function GroupPage() {
  return (
    <Protected>
      <GroupScreen />
    </Protected>
  );
}

function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useSignedInUser();
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checkingStart, setCheckingStart] = useState(false);

  useEffect(() => subscribeGroup(id, setGroup, (e) => { setError(e.message); setGroup(null); }), [id]);
  useEffect(() => subscribeGroupSessions(id, user.uid, setSessions, (e) => setError(e.message)), [id, user.uid]);

  if (group === undefined) return <Loading />;
  if (group === null) {
    return (
      <Screen>
        <Muted>This group doesn’t exist, or you’re not a member.</Muted>
        <ErrorText message={error} />
      </Screen>
    );
  }

  const share = async () => {
    try {
      await Share.share({
        message: `Join "${group.name}" on TileTalk with invite code ${group.inviteCode}`,
      });
    } catch {
      // Sharing isn't available everywhere (e.g. some desktop browsers); the code is on screen anyway.
    }
  };

  const active = sessions.filter((s) => s.status === 'active');
  const startNew = () => {
    setCheckingStart(false);
    router.push(`/session/new?groupId=${group.id}`);
  };
  const finished = sessions.filter((s) => s.status === 'finished');

  return (
    <Screen>
      <Stack.Screen options={{ title: group.name }} />
      <Title>{group.name}</Title>

      {checkingStart && active.length > 0 ? (
        // Nudge people into the game that's already running, so the table doesn't end up
        // recording the same hands twice in two separate games.
        <Card>
          <SectionTitle>{active.length === 1 ? 'A game is already running' : `${active.length} games are already running`}</SectionTitle>
          {active.map((s) => (
            <View key={s.id} style={styles.running}>
              <Muted>
                With {s.players.map((p) => p.name).join(', ')}. {WIND_NAMES[s.table.prevailingWind]} round, hand{' '}
                {s.table.handNumber}.
              </Muted>
              <Button title={active.length === 1 ? 'Open it' : 'Open this game'} onPress={() => router.push(`/session/${s.id}`)} />
            </View>
          ))}
          <Button title="Start another game" variant="secondary" onPress={startNew} />
          <Button title="Cancel" variant="secondary" onPress={() => setCheckingStart(false)} />
        </Card>
      ) : (
        <Button title="Start a game" onPress={() => (active.length > 0 ? setCheckingStart(true) : startNew())} />
      )}

      <ErrorText message={error} />

      {active.length > 0 ? (
        <>
          <SectionTitle>In progress</SectionTitle>
          {active.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </>
      ) : null}

      <Card>
        <SectionTitle>Invite code</SectionTitle>
        <Row style={{ gap: 6 }}>
          {group.inviteCode.split('').map((ch, i) => (
            <Tile key={i} char={ch} size={36} />
          ))}
        </Row>
        <Muted>Friends enter this code on their Games page to join. They don’t need an account.</Muted>
        <Button title="Share invite" variant="secondary" onPress={share} />
      </Card>

      <SectionTitle>Members</SectionTitle>
      <View style={styles.members}>
        {group.memberIds.map((uid) => {
          const m = group.members?.[uid];
          return (
            <Pressable
              key={uid}
              accessibilityRole="button"
              accessibilityHint="Opens their profile"
              onPress={() => router.push({ pathname: '/player/[uid]', params: { uid } })}
              style={({ pressed }) => [styles.member, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.memberText}>
                {m?.avatar ?? '🀄'} {m?.name ?? 'Player'}
                {uid === group.ownerId ? '  (organiser)' : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {finished.length > 0 ? (
        <>
          <SectionTitle>Past games</SectionTitle>
          {finished.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  members: { gap: 8 },
  member: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.control,
    backgroundColor: colors.feltDeep,
  },
  memberText: { color: colors.text, fontSize: 15 },
  running: { gap: 8 },
});
