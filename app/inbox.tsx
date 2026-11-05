import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { displayNameOf, Protected, useAuth, useSignedInUser } from '../src/auth';
import { acceptGroupInvite, deleteGroupInvite } from '../src/db';
import { useInbox } from '../src/inbox';
import { radius, themedStyles } from '../src/theme';
import type { GroupInvite } from '../src/types';
import { Button, ErrorText, Muted, Row, Screen } from '../src/ui';

export default function InboxPage() {
  return (
    <Protected>
      <InboxScreen />
    </Protected>
  );
}

function InboxScreen() {
  const styles = useStyles();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const { invites, error: loadError } = useInbox();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const answer = async (invite: GroupInvite, accept: boolean) => {
    setBusy(invite.id);
    setError(null);
    try {
      if (accept) {
        await acceptGroupInvite(invite, user.uid, { name: displayNameOf(profile), avatar: profile?.avatar ?? '🀄' });
        router.push({ pathname: '/group/[id]', params: { id: invite.groupId } });
      } else {
        await deleteGroupInvite(invite.id);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <ErrorText message={error ?? loadError} />
      {invites.length === 0 ? (
        <Muted>Nothing here. When someone invites you to a group, it shows up here.</Muted>
      ) : (
        invites.map((invite) => (
          <View key={invite.id} style={styles.item}>
            <Text style={styles.title}>
              {invite.fromAvatar} {invite.fromName} invited you to {invite.groupName}
            </Text>
            <Muted>{invite.createdAt ? new Date(invite.createdAt.toMillis()).toLocaleDateString() : 'Just now'}</Muted>
            <Row>
              <Button title="Join group" onPress={() => answer(invite, true)} loading={busy === invite.id} />
              <Button title="Decline" variant="secondary" onPress={() => answer(invite, false)} disabled={busy === invite.id} />
            </Row>
          </View>
        ))
      )}
    </Screen>
  );
}

const useStyles = themedStyles((colors) => ({
  item: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    padding: 14,
    gap: 8,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', lineHeight: 22 },
}));
