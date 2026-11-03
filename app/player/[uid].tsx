import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { displayNameOf, Protected, useSignedInUser } from '../../src/auth';
import { StatsGrid } from '../../src/components/StatsGrid';
import { TitleCard } from '../../src/components/TitleCard';
import { setGrantedTitle, subscribeIsAdmin, subscribeProfile } from '../../src/db';
import { shownTitles, TITLES } from '../../src/game/titles';
import { normaliseStats, UserProfile } from '../../src/types';
import { Button, Card, ErrorText, Loading, Muted, Screen, SectionTitle, Title } from '../../src/ui';

/** What anyone can see about a player: their avatar, chosen titles and career stats. */
export default function PlayerPage() {
  return (
    <Protected>
      <PlayerScreen />
    </Protected>
  );
}

function PlayerScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const me = useSignedInUser();
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => subscribeProfile(uid, setProfile, (e) => { setError(e.message); setProfile(null); }), [uid]);
  useEffect(() => subscribeIsAdmin(me.uid, setIsAdmin), [me.uid]);

  if (profile === undefined) return <Loading />;
  if (profile === null) return <Screen><Muted>This player doesn’t exist.</Muted><ErrorText message={error} /></Screen>;

  const titles = shownTitles(profile);
  const isMe = uid === me.uid;

  return (
    <Screen>
      <Stack.Screen options={{ title: displayNameOf(profile) }} />
      <View style={styles.header}>
        <Text style={styles.avatar}>{profile.avatar}</Text>
        <Title>{displayNameOf(profile)}</Title>
        {profile.registered ? null : <Muted>Playing as a guest</Muted>}
      </View>

      <SectionTitle>Titles</SectionTitle>
      {titles.length === 0 ? (
        <Muted>{isMe ? 'You’re not showing any titles yet.' : 'No titles on show yet.'}</Muted>
      ) : (
        <View style={styles.list}>
          {titles.map((t) => (
            <TitleCard key={t.key} def={t.def} groupName={t.groupName} />
          ))}
        </View>
      )}
      {isMe ? <Button title="Choose titles" variant="secondary" onPress={() => router.push('/profile/titles')} /> : null}

      <SectionTitle>Career stats</SectionTitle>
      <StatsGrid stats={normaliseStats(profile.stats)} />

      {isAdmin ? <AdminTitles profile={profile} /> : null}
    </Screen>
  );
}

/** Only admins see this. The Firestore rules stop anyone else from giving these titles. */
function AdminTitles({ profile }: { profile: UserProfile }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (id: string, give: boolean) => {
    setBusy(id);
    setError(null);
    try {
      await setGrantedTitle(profile.uid, id, give);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <SectionTitle>Admin</SectionTitle>
      <Muted>Titles only you can give. They show up on this player’s titles page straight away.</Muted>
      {TITLES.filter((t) => t.grantOnly).map((t) => {
        const has = (profile.grantedTitles ?? []).includes(t.id);
        return (
          <Button
            key={t.id}
            title={has ? `Take back ${t.name}` : `Give ${t.name}`}
            variant={has ? 'secondary' : 'primary'}
            loading={busy === t.id}
            onPress={() => toggle(t.id, !has)}
          />
        );
      })}
      <ErrorText message={error} />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  avatar: { fontSize: 72, lineHeight: 88 },
  list: { gap: 10 },
});
