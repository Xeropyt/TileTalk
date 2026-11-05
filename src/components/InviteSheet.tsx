import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { displayNameOf, useAuth, useSignedInUser } from '../auth';
import { sendGroupInvite, subscribeLeaderboard, subscribeSentInvites } from '../db';
import { radius, themedStyles } from '../theme';
import type { Group, UserProfile } from '../types';
import { Chip, ErrorText, Field, Loading, Muted } from '../ui';
import { Sheet } from './Sheet';

/** Pick players with accounts and send them an invitation to the group, straight to their inbox. */
export function InviteSheet({ group, visible, onClose }: { group: Group; visible: boolean; onClose: () => void }) {
  const styles = useStyles();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const [players, setPlayers] = useState<UserProfile[] | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => (visible ? subscribeLeaderboard(setPlayers, (e) => setError(e.message)) : undefined), [visible]);
  useEffect(
    () =>
      visible
        ? subscribeSentInvites(user.uid, group.id, (i) => setInvited(new Set(i.map((x) => x.toUid))), (e) => setError(e.message))
        : undefined,
    [visible, user.uid, group.id],
  );

  const term = search.trim().toLowerCase();
  const choices = useMemo(
    () =>
      (players ?? [])
        .filter((p) => !group.memberIds.includes(p.uid) && displayNameOf(p).toLowerCase().includes(term))
        .sort((a, b) => displayNameOf(a).localeCompare(displayNameOf(b))),
    [players, group.memberIds, term],
  );

  const invite = async (p: UserProfile) => {
    setError(null);
    setSending(p.uid);
    try {
      await sendGroupInvite(group, p.uid, { uid: user.uid, name: displayNameOf(profile), avatar: profile?.avatar ?? '🀄' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(null);
    }
  };

  return (
    <Sheet visible={visible} title={`Invite to ${group.name}`} onClose={onClose}>
      <Muted>They’ll find it in the inbox on their Hub page. Friends without an account can still join with the invite code.</Muted>
      <Field label="Search" value={search} onChangeText={setSearch} placeholder="Name" autoCapitalize="none" />
      <ErrorText message={error} />
      {players === null ? (
        <Loading />
      ) : choices.length === 0 ? (
        <Muted>{term ? 'Nobody by that name.' : 'Everyone with an account is already in this group.'}</Muted>
      ) : (
        choices.map((p) => {
          const done = invited.has(p.uid);
          return (
            <View key={p.uid} style={styles.row}>
              <Text style={styles.name} numberOfLines={1}>
                {p.avatar} {displayNameOf(p)}
              </Text>
              <Chip
                label={done ? 'Invited' : sending === p.uid ? 'Sending…' : 'Invite'}
                selected={done}
                disabled={done || sending === p.uid}
                onPress={() => invite(p)}
              />
            </View>
          );
        })
      )}
    </Sheet>
  );
}

const useStyles = themedStyles((colors) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.control,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 8,
  },
  name: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
}));
