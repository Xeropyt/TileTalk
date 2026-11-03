import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { displayNameOf, Protected, useAuth, useSignedInUser } from '../../src/auth';
import { TileImage } from '../../src/components/TileArt';
import { sharePost } from '../../src/db';
import { BONUS_TILES, HAND_TILES, MAX_HAND_TILES, maxCopies, MIN_HAND_TILES, sortTiles, tileName } from '../../src/game/tiles';
import { useLastBestWin } from '../../src/hubData';
import { findPattern, formatHandValue, getRuleset, limitName } from '../../src/scoring';
import { colors, radius } from '../../src/theme';
import { Button, Card, ErrorText, Field, Loading, Muted, Row, Screen, SectionTitle } from '../../src/ui';

const PICKER_GROUPS: { name: string; tiles: string[] }[] = [
  { name: 'Characters', tiles: HAND_TILES.slice(0, 9) },
  { name: 'Dots', tiles: HAND_TILES.slice(9, 18) },
  { name: 'Bamboo', tiles: HAND_TILES.slice(18, 27) },
  { name: 'Winds and dragons', tiles: HAND_TILES.slice(27) },
  { name: 'Flowers and seasons', tiles: BONUS_TILES },
];
const PICKER_TILE = 34;
const LAID_TILE = 30;

export default function SharePage() {
  return (
    <Protected>
      <ShareScreen />
    </Protected>
  );
}

function ShareScreen() {
  const user = useSignedInUser();
  const { profile } = useAuth();
  const { loading, game, hand } = useLastBestWin(user.uid);
  const [tiles, setTiles] = useState<string[]>([]);
  const [flowers, setFlowers] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <Loading />;
  if (!game || !hand) {
    return (
      <Screen>
        <Muted>There’s no winning hand from your last game to share.</Muted>
      </Screen>
    );
  }

  const ruleset = getRuleset(game.rulesetId);
  const discarder = game.players.find((p) => p.id === hand.discarderId);
  const myId = game.players.find((p) => p.uid === user.uid)?.id;
  const myRiichiWin = hand.riichi?.winners.find((w) => w.playerId === myId);
  const used = (code: string) => [...tiles, ...flowers].filter((t) => t === code).length;
  const isBonus = (code: string) => BONUS_TILES.includes(code);

  const add = (code: string) => {
    setError(null);
    if (used(code) >= maxCopies(code)) return;
    if (isBonus(code)) return setFlowers(sortTiles([...flowers, code]));
    if (tiles.length >= MAX_HAND_TILES) return setError(`A hand has at most ${MAX_HAND_TILES} tiles, with four kongs.`);
    setTiles([...tiles, code]);
  };
  const removeAt = (i: number) => setTiles(tiles.filter((_, j) => j !== i));

  const ready = tiles.length >= MIN_HAND_TILES && tiles.length <= MAX_HAND_TILES;

  const post = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await sharePost({
        authorUid: user.uid,
        authorName: displayNameOf(profile),
        authorAvatar: profile?.avatar ?? '🀄',
        sessionId: game.id,
        handNumber: hand.handNumber,
        rulesetId: game.rulesetId,
        tai: hand.tai,
        winType: hand.winType ?? 'discard',
        discarderName: discarder?.name ?? null,
        patterns: hand.patterns,
        tiles,
        flowers,
        caption: caption.trim(),
      });
      router.replace({ pathname: '/post/[id]', params: { id } });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <SectionTitle>
          {formatHandValue(game.rulesetId, hand.tai)}, {hand.winType === 'selfDraw' ? 'self-drawn' : `off ${discarder?.name ?? 'a discard'}`}
        </SectionTitle>
        <Muted>
          {hand.patterns
            .map((p) => findPattern(ruleset, p.id)?.name)
            .filter(Boolean)
            .join(', ') || (myRiichiWin ? limitName(myRiichiWin.base) ?? `${myRiichiWin.han} han ${myRiichiWin.fu} fu` : 'No patterns recorded.')}
        </Muted>
      </Card>

      <SectionTitle>Your hand</SectionTitle>
      <Muted>
        Tap tiles below to lay out your hand in order. Tap a tile here to take it out. {tiles.length} of {MIN_HAND_TILES} tiles
        {tiles.length > MIN_HAND_TILES ? ` (+${tiles.length - MIN_HAND_TILES} for kongs)` : ''}.
      </Muted>
      <View style={styles.laid}>
        {tiles.length === 0 ? <Muted>No tiles yet.</Muted> : null}
        {tiles.map((t, i) => (
          <Pressable
            key={`${t}-${i}`}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${tileName(t)}`}
            onPress={() => removeAt(i)}
          >
            <TileImage code={t} width={LAID_TILE} />
          </Pressable>
        ))}
      </View>
      {flowers.length > 0 ? (
        <View style={styles.laid}>
          <Text style={styles.flowerLabel}>Flowers</Text>
          {flowers.map((t) => (
            <Pressable
              key={t}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${tileName(t)}`}
              onPress={() => setFlowers(flowers.filter((f) => f !== t))}
            >
              <TileImage code={t} width={LAID_TILE * 0.8} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <Row>
        <Button title="Sort" variant="secondary" onPress={() => setTiles(sortTiles(tiles))} disabled={tiles.length < 2} />
        <Button
          title="Clear"
          variant="secondary"
          onPress={() => {
            setTiles([]);
            setFlowers([]);
          }}
          disabled={tiles.length + flowers.length === 0}
        />
      </Row>

      {PICKER_GROUPS.map((g) => (
        <View key={g.name} style={styles.group}>
          <Text style={styles.groupName}>{g.name}</Text>
          <View style={styles.picker}>
            {g.tiles.map((t) => {
              const left = maxCopies(t) - used(t);
              return (
                <Pressable
                  key={t}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${tileName(t)}`}
                  accessibilityState={{ disabled: left === 0 }}
                  disabled={left === 0}
                  onPress={() => add(t)}
                  style={({ pressed }) => pressed && { opacity: 0.7 }}
                >
                  <TileImage code={t} width={PICKER_TILE} dim={left === 0} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <Field label="Caption (optional)" value={caption} onChangeText={setCaption} maxLength={280} placeholder="Called it from the first draw" />
      <ErrorText message={error} />
      <Button
        title={ready ? 'Share to the Hub' : `Add ${MIN_HAND_TILES - tiles.length} more tiles`}
        onPress={post}
        disabled={!ready}
        loading={busy}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  laid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 3,
    minHeight: 48,
    padding: 8,
    borderRadius: radius.control,
    backgroundColor: colors.feltDeep,
  },
  flowerLabel: { color: colors.muted, fontSize: 12, fontWeight: '600', marginRight: 6 },
  group: { gap: 6 },
  groupName: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
