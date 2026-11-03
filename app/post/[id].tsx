import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { displayNameOf, Protected, useAuth, useSignedInUser } from '../../src/auth';
import { PostCard } from '../../src/components/PostCard';
import { addComment, deleteComment, deletePost, subscribeComments, subscribeIsAdmin, subscribePost } from '../../src/db';
import { colors, radius } from '../../src/theme';
import type { HubComment, HubPost } from '../../src/types';
import { Button, Chip, ErrorText, Field, Loading, Muted, Screen, SectionTitle } from '../../src/ui';

const MAX_COMMENT = 500;

export default function PostPage() {
  return (
    <Protected>
      <PostScreen />
    </Protected>
  );
}

function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const [post, setPost] = useState<HubPost | null | undefined>(undefined);
  const [comments, setComments] = useState<HubComment[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribePost(id, setPost, (e) => { setError(e.message); setPost(null); }), [id]);
  useEffect(() => subscribeComments(id, setComments, (e) => setError(e.message)), [id]);
  useEffect(() => subscribeIsAdmin(user.uid, setIsAdmin), [user.uid]);

  if (post === undefined) return <Loading />;
  if (post === null) return <Screen><Muted>This post has been deleted.</Muted><ErrorText message={error} /></Screen>;

  const isAuthor = post.authorUid === user.uid;

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    setError(null);
    try {
      await addComment(post.id, { authorUid: user.uid, authorName: displayNameOf(profile), authorAvatar: profile?.avatar ?? '🀄', text: t });
      setText('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  // Two taps to delete anything, so nothing goes by accident.
  const confirmThen = async (key: string, action: () => Promise<void>) => {
    if (confirm !== key) return setConfirm(key);
    setConfirm(null);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Screen>
      <PostCard post={post} uid={user.uid} showCommentsLink={false} />

      <SectionTitle>Comments</SectionTitle>
      {comments.length === 0 ? <Muted>No comments yet.</Muted> : null}
      {comments.map((c) => {
        const canDelete = c.authorUid === user.uid || isAuthor || isAdmin;
        return (
          <View key={c.id} style={styles.comment}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${c.authorName}’s profile`}
              onPress={() => router.push({ pathname: '/player/[uid]', params: { uid: c.authorUid } })}
              style={({ pressed }) => [styles.commentAuthor, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.commentAvatar}>{c.authorAvatar}</Text>
            </Pressable>
            <View style={styles.commentBody}>
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Opens their profile"
                onPress={() => router.push({ pathname: '/player/[uid]', params: { uid: c.authorUid } })}
              >
                <Text style={styles.commentName}>{c.authorName}</Text>
              </Pressable>
              <Text style={styles.commentText}>{c.text}</Text>
            </View>
            {canDelete ? (
              <Chip
                label={confirm === c.id ? 'Tap to delete' : 'Delete'}
                selected={confirm === c.id}
                onPress={() => confirmThen(c.id, () => deleteComment(post.id, c.id))}
              />
            ) : null}
          </View>
        );
      })}

      <Field
        label="Add a comment"
        value={text}
        onChangeText={setText}
        maxLength={MAX_COMMENT}
        multiline
        placeholder="That last tile though"
      />
      <Button title="Post comment" onPress={send} disabled={!text.trim()} loading={sending} />
      <ErrorText message={error} />

      {isAuthor || isAdmin ? (
        <Button
          title={confirm === 'post' ? 'Tap again to delete this post' : 'Delete post'}
          variant="secondary"
          onPress={() =>
            confirmThen('post', async () => {
              await deletePost(post.id);
              if (router.canGoBack()) router.back();
              else router.replace('/?tab=hub');
            })
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.feltDeep,
    borderRadius: radius.control,
    padding: 10,
  },
  commentAuthor: { paddingTop: 2 },
  commentAvatar: { fontSize: 22 },
  commentBody: { flex: 1, gap: 2 },
  commentName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  commentText: { color: colors.text, fontSize: 15, lineHeight: 21 },
});
