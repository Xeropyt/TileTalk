import React, { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Link, router } from 'expo-router';
import { displayNameOf, Protected, useAuth, useSignedInUser } from '../auth';
import { SessionRow } from '../components/SessionRow';
import {
  createGroup,
  joinGroup,
  subscribeAllGroups,
  subscribeIsAdmin,
  subscribeMyGroups,
  subscribeMySessions,
  updateProfile,
} from '../db';
import { radius, themedStyles } from '../theme';
import type { Group, Session } from '../types';
import { Button, Card, ErrorText, Field, Loading, Muted, SectionTitle, Title } from '../ui';
import { TabPage } from './TabPage';

const HISTORY_PREVIEW = 5;

export function GamesPage() {
  return (
    <Protected>
      <GamesContent />
    </Protected>
  );
}

function GamesContent() {
  const styles = useStyles();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [newName, setNewName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeMyGroups(user.uid, setGroups, (e) => setError(e.message)), [user.uid]);
  useEffect(() => subscribeMySessions(user.uid, setSessions, (e) => setError(e.message)), [user.uid]);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => subscribeIsAdmin(user.uid, setIsAdmin), [user.uid]);

  const hasName = !!profile?.displayName?.trim();
  const me = { name: displayNameOf(profile), avatar: profile?.avatar ?? '🀄' };
  const groupName = (id: string) => groups?.find((g) => g.id === id)?.name;
  const active = sessions?.filter((s) => s.status === 'active') ?? [];
  const finished = sessions?.filter((s) => s.status === 'finished') ?? [];
  const history = showAllHistory ? finished : finished.slice(0, HISTORY_PREVIEW);

  const run = async (kind: 'create' | 'join', action: () => Promise<string>) => {
    if (!hasName) return setError('Add your name first, so your table knows who you are.');
    setError(null);
    setBusy(kind);
    try {
      const id = await action();
      setNewName('');
      setCode('');
      router.push(`/group/${id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onCreate = () => {
    if (!newName.trim()) return setError('Give the group a name first.');
    run('create', () => createGroup(newName, user.uid, me));
  };

  const onJoin = () => {
    if (code.trim().length < 6) return setError('Invite codes are 6 characters.');
    run('join', () => joinGroup(code, user.uid, me));
  };

  return (
    <TabPage>
      <Title>{hasName ? `Hi, ${me.name}` : 'TileTalk'}</Title>
      <Muted>Scores, winds and dice for your mahjong table.</Muted>

      {profile && !hasName ? <NameCard uid={user.uid} /> : null}

      <ErrorText message={error} />

      {active.length > 0 ? (
        <>
          <SectionTitle>In progress</SectionTitle>
          {active.map((s) => (
            <SessionRow key={s.id} session={s} groupName={groupName(s.groupId)} />
          ))}
        </>
      ) : null}

      <SectionTitle>Your groups</SectionTitle>
      {groups === null ? (
        <Loading />
      ) : groups.length === 0 ? (
        <Muted>Create a group for your regular table, or join one with an invite code. Start games from inside a group.</Muted>
      ) : (
        groups.map((g) => (
          <Link key={g.id} href={`/group/${g.id}`} asChild>
            <Pressable style={({ pressed }) => [styles.groupRow, pressed && { opacity: 0.75 }]} accessibilityRole="button">
              <Text style={styles.groupName}>{g.name}</Text>
              <Muted>
                {g.memberIds.length} {g.memberIds.length === 1 ? 'member' : 'members'}. Tap to start a game.
              </Muted>
            </Pressable>
          </Link>
        ))
      )}

      <Card>
        <SectionTitle>Create a group</SectionTitle>
        <Field label="Group name" value={newName} onChangeText={setNewName} placeholder="Friday night table" />
        <Button title="Create group" onPress={onCreate} loading={busy === 'create'} />
      </Card>

      <Card>
        <SectionTitle>Join a group</SectionTitle>
        <Field
          label="Invite code"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
          placeholder="ABC123"
        />
        <Button title="Join group" variant="secondary" onPress={onJoin} loading={busy === 'join'} />
      </Card>

      {isAdmin ? <AdminGroups /> : null}

      <SectionTitle>History</SectionTitle>
      {sessions === null ? (
        <Loading />
      ) : finished.length === 0 ? (
        <Muted>Finished games show up here.</Muted>
      ) : (
        <>
          {history.map((s) => (
            <SessionRow key={s.id} session={s} groupName={groupName(s.groupId)} />
          ))}
          {finished.length > HISTORY_PREVIEW ? (
            <Button
              title={showAllHistory ? 'Show fewer' : `Show all ${finished.length} games`}
              variant="secondary"
              onPress={() => setShowAllHistory(!showAllHistory)}
            />
          ) : null}
        </>
      )}
    </TabPage>
  );
}

/** Admins only: every group, including ones they're not in, so they can open and delete them. */
function AdminGroups() {
  const styles = useStyles();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => subscribeAllGroups(setGroups, (e) => setError(e.message)), []);
  return (
    <Card>
      <SectionTitle>All groups (admin)</SectionTitle>
      <Muted>Open a group to delete it.</Muted>
      <ErrorText message={error} />
      {groups === null ? (
        <Loading />
      ) : (
        groups.map((g) => (
          <Link key={g.id} href={`/group/${g.id}`} asChild>
            <Pressable style={({ pressed }) => [styles.adminRow, pressed && { opacity: 0.75 }]} accessibilityRole="button">
              <Text style={styles.adminName}>{g.name}</Text>
              <Muted>
                {g.memberIds.length} {g.memberIds.length === 1 ? 'member' : 'members'}
              </Muted>
            </Pressable>
          </Link>
        ))
      )}
    </Card>
  );
}

/** First-run prompt. A name is all anyone needs to start playing. */
function NameCard({ uid }: { uid: string }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile(uid, { displayName: name.trim() });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Card>
      <SectionTitle>What does your table call you?</SectionTitle>
      <Muted>No account needed. You can create one later from your profile to keep your stats on every device.</Muted>
      <Field label="Your name" value={name} onChangeText={setName} autoCapitalize="words" onSubmitEditing={save} />
      <Button title="Save" onPress={save} disabled={!name.trim()} loading={saving} />
      <ErrorText message={error} />
    </Card>
  );
}

const useStyles = themedStyles((colors) => ({
  groupRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
  groupName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  adminRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceDeep,
  },
  adminName: { color: colors.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
}));
