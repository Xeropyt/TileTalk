import React, { useState } from 'react';
import { router } from 'expo-router';
import { displayNameOf, Protected, useAuth, useSignedInUser } from '../../src/auth';
import { TilePicker } from '../../src/components/TilePicker';
import { sharePost } from '../../src/db';
import { MAX_HAND_TILES, MIN_HAND_TILES } from '../../src/game/tiles';
import { useLastBestWin } from '../../src/hubData';
import { findPattern, formatHandValue, getRuleset, limitName } from '../../src/scoring';
import { Button, Card, ErrorText, Field, Loading, Muted, Screen, SectionTitle } from '../../src/ui';

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
      <TilePicker
        tiles={tiles}
        flowers={flowers}
        onChange={(t, f) => {
          setTiles(t);
          setFlowers(f);
        }}
        onError={setError}
      />

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
