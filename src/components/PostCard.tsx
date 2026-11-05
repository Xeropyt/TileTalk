import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { displayNameOf } from '../auth';
import { fetchProfiles, setLiked } from '../db';
import { findPattern, formatHandValue, getRuleset } from '../scoring';
import { radius, themedStyles } from '../theme';
import type { HubPost, UserProfile } from '../types';
import { Chip, ErrorText, Muted } from '../ui';
import { Sheet } from './Sheet';
import { HandView } from './TileArt';

/** A shared winning hand, drawn as tiles, with likes and comments. */
export function PostCard({ post, uid, showCommentsLink = true }: { post: HubPost; uid: string; showCommentsLink?: boolean }) {
  const styles = useStyles();
  const [error, setError] = useState<string | null>(null);
  const [showLikes, setShowLikes] = useState(false);
  const likers = useProfiles(post.likedBy);
  const ruleset = getRuleset(post.rulesetId);
  const liked = post.likedBy.includes(uid);
  const likes = post.likedBy.length;
  const date = post.createdAt ? new Date(post.createdAt.toMillis()).toLocaleDateString() : 'Just now';
  const how = post.winType === 'selfDraw' ? 'self-drawn' : post.discarderName ? `off ${post.discarderName}` : 'off a discard';
  const patterns = post.patterns
    .map((p) => {
      const def = findPattern(ruleset, p.id);
      return def ? `${def.name}${p.count > 1 ? ` ×${p.count}` : ''}` : null;
    })
    .filter(Boolean)
    .join(', ');

  const toggleLike = async () => {
    setError(null);
    try {
      await setLiked(post.id, uid, !liked);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens their profile"
        onPress={() => router.push({ pathname: '/player/[uid]', params: { uid: post.authorUid } })}
        style={styles.header}
      >
        <Text style={styles.avatar}>{post.authorAvatar}</Text>
        <View style={styles.headerText}>
          <Text style={styles.name}>{post.authorName}</Text>
          <Muted>{date}</Muted>
        </View>
        <Text style={styles.tai}>{formatHandValue(post.rulesetId, post.tai)}</Text>
      </Pressable>

      <Muted>
        Best hand of their last game, {how}
        {patterns ? `: ${patterns}` : ''}.
      </Muted>
      {/* Flowers a little bigger than in the game history, so they're easy to make out. */}
      <HandView tiles={post.tiles} flowers={post.flowers} flowerScale={0.9} />
      {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}

      <View style={styles.actions}>
        <Chip label={`${liked ? '♥' : '♡'} ${likes}`} selected={liked} onPress={toggleLike} />
        {showCommentsLink ? (
          <Chip
            label={`💬 ${post.commentCount} ${post.commentCount === 1 ? 'comment' : 'comments'}`}
            onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
          />
        ) : null}
      </View>
      {likes > 0 ? (
        <Pressable accessibilityRole="button" accessibilityHint="Shows everyone who liked it" onPress={() => setShowLikes(true)}>
          <Text style={styles.likedBy}>Liked by {likedBySummary(post.likedBy, likers, uid)}</Text>
        </Pressable>
      ) : null}
      <ErrorText message={error} />

      <Sheet visible={showLikes} title={`${likes} ${likes === 1 ? 'like' : 'likes'}`} onClose={() => setShowLikes(false)}>
        {post.likedBy.map((id) => {
          const p = likers.find((x) => x.uid === id);
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityHint="Opens their profile"
              onPress={() => {
                setShowLikes(false);
                router.push({ pathname: '/player/[uid]', params: { uid: id } });
              }}
              style={({ pressed }) => [styles.liker, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.likerName}>
                {p ? `${p.avatar} ${displayNameOf(p)}` : '…'}
                {id === uid ? ' (you)' : ''}
              </Text>
            </Pressable>
          );
        })}
      </Sheet>
    </View>
  );
}

/** Profiles for a list of players, fetched once each. */
function useProfiles(uids: string[]): UserProfile[] {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const key = uids.join(',');
  useEffect(() => {
    let live = true;
    fetchProfiles(uids).then((p) => live && setProfiles(p), () => {});
    return () => {
      live = false;
    };
  }, [key]);
  return profiles;
}

/** "You, Amy and 3 others": you first, then up to two names. */
function likedBySummary(likedBy: string[], profiles: UserProfile[], uid: string): string {
  const ordered = [...likedBy].sort((a, b) => (a === uid ? -1 : b === uid ? 1 : 0));
  const names = ordered.slice(0, 2).map((id) => (id === uid ? 'you' : displayNameOf(profiles.find((p) => p.uid === id) ?? null)));
  const rest = ordered.length - names.length;
  if (rest > 0) return `${names.join(', ')} and ${rest} ${rest === 1 ? 'other' : 'others'}`;
  return names.join(' and ');
}

const useStyles = themedStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText: { flex: 1 },
  avatar: { fontSize: 30 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  tai: { color: colors.highlight, fontSize: 20, fontWeight: '700' },
  caption: { color: colors.text, fontSize: 15, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  likedBy: { color: colors.textMuted, fontSize: 14, textDecorationLine: 'underline' },
  liker: { backgroundColor: colors.surfaceDeep, borderRadius: radius.control, paddingVertical: 12, paddingHorizontal: 14 },
  likerName: { color: colors.text, fontSize: 15, fontWeight: '600' },
}));
