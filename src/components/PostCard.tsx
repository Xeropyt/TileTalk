import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { setLiked } from '../db';
import { findPattern, formatHandValue, getRuleset } from '../scoring';
import { colors, radius } from '../theme';
import type { HubPost } from '../types';
import { Chip, ErrorText, Muted } from '../ui';
import { HandView } from './TileArt';

/** A shared winning hand, drawn as tiles, with likes and comments. */
export function PostCard({ post, uid, showCommentsLink = true }: { post: HubPost; uid: string; showCommentsLink?: boolean }) {
  const [error, setError] = useState<string | null>(null);
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
      <HandView tiles={post.tiles} flowers={post.flowers} />
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
      <ErrorText message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.feltRaised,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.feltLine,
    padding: 14,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText: { flex: 1 },
  avatar: { fontSize: 30 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  tai: { color: colors.ivory, fontSize: 20, fontWeight: '700' },
  caption: { color: colors.text, fontSize: 15, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
