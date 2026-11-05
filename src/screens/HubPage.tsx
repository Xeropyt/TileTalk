import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Protected, useSignedInUser } from '../auth';
import { PostCard } from '../components/PostCard';
import { Badge } from '../components/Sheet';
import { postIdFor, subscribeFeed } from '../db';
import { useLastBestWin } from '../hubData';
import { useInbox } from '../inbox';
import { formatHandValue } from '../scoring';
import { radius, themedStyles } from '../theme';
import type { HubPost } from '../types';
import { Button, Card, ErrorText, Loading, Muted, SectionTitle, Title } from '../ui';
import { TabPage } from './TabPage';

export function HubPage() {
  return (
    <Protected>
      <HubContent />
    </Protected>
  );
}

function HubContent() {
  const styles = useStyles();
  const user = useSignedInUser();
  const [posts, setPosts] = useState<HubPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const best = useLastBestWin(user.uid);
  const { invites } = useInbox();

  useEffect(() => subscribeFeed(setPosts, (e) => setError(e.message)), []);

  const alreadyShared = !!best.game && !!posts?.some((p) => p.id === postIdFor(user.uid, best.game!.id));

  return (
    <TabPage>
      <View style={styles.header}>
        <Title>Hub</Title>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={invites.length ? `Inbox, ${invites.length} new` : 'Inbox'}
          onPress={() => router.push('/inbox')}
          style={({ pressed }) => [styles.inbox, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.inboxIcon}>✉️</Text>
          <Badge count={invites.length} style={styles.inboxBadge} />
        </Pressable>
      </View>
      <Muted>The best hands from everyone’s last game. Like them, and have your say.</Muted>

      {best.loading ? null : (
        <Card>
          <SectionTitle>Your last game</SectionTitle>
          {!best.game ? (
            <Muted>Finish a game and your best winning hand can go up here.</Muted>
          ) : !best.hand ? (
            <Muted>You didn’t win a hand in your last game. Next time.</Muted>
          ) : alreadyShared ? (
            <>
              <Muted>You’ve shared your {formatHandValue(best.game.rulesetId, best.hand.tai)} hand from it.</Muted>
              <Button
                title="See your post"
                variant="secondary"
                onPress={() => router.push({ pathname: '/post/[id]', params: { id: postIdFor(user.uid, best.game!.id) } })}
              />
            </>
          ) : (
            <>
              <Muted>Your best win was {formatHandValue(best.game.rulesetId, best.hand.tai)}. Lay out its tiles and share it.</Muted>
              <Button title="Share your best hand" onPress={() => router.push('/hub/share')} />
            </>
          )}
        </Card>
      )}

      <ErrorText message={error} />
      {posts === null ? (
        <Loading />
      ) : posts.length === 0 ? (
        <Muted>No hands shared yet. Be the first.</Muted>
      ) : (
        <View style={styles.feed}>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} uid={user.uid} />
          ))}
        </View>
      )}
    </TabPage>
  );
}

const useStyles = themedStyles((colors) => ({
  feed: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inbox: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxIcon: { fontSize: 20 },
  inboxBadge: { position: 'absolute', top: -5, right: -5 },
}));
