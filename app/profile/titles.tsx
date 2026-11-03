import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Protected, useAuth, useSignedInUser } from '../../src/auth';
import { TitleCard } from '../../src/components/TitleCard';
import { updateProfile } from '../../src/db';
import { CATEGORY_NAMES, MAX_SHOWN_TITLES, ownedTitles, shownTitles, TitleCategory, TITLES } from '../../src/game/titles';
import { ErrorText, Loading, Muted, Screen, SectionTitle } from '../../src/ui';

const CATEGORY_ORDER: TitleCategory[] = ['glory', 'shame', 'milestone'];

export default function TitlesPage() {
  return (
    <Protected>
      <TitlesScreen />
    </Protected>
  );
}

function TitlesScreen() {
  const user = useSignedInUser();
  const { profile } = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (!profile) return <Loading />;

  const owned = ownedTitles(profile);
  const shown = shownTitles(profile).map((t) => t.key);
  const ownedIds = new Set(owned.map((o) => o.def.id));
  const locked = TITLES.filter((t) => !ownedIds.has(t.id));

  const toggle = async (key: string) => {
    setError(null);
    const next = shown.includes(key) ? shown.filter((k) => k !== key) : [...shown, key];
    if (next.length > MAX_SHOWN_TITLES) {
      setError(`You can show up to ${MAX_SHOWN_TITLES}. Tap one you’re showing to take it off first.`);
      return;
    }
    try {
      await updateProfile(user.uid, { displayedTitles: next });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Screen>
      <Muted>
        Tap a title you’ve earned to show it on your public profile and the leaderboard. You can show up to{' '}
        {MAX_SHOWN_TITLES}. Titles update when you open TileTalk.
      </Muted>
      <ErrorText message={error} />

      <SectionTitle>
        Earned ({owned.length} of {TITLES.length})
      </SectionTitle>
      {owned.length === 0 ? (
        <Muted>None yet. Play a few hands and check back.</Muted>
      ) : (
        <View style={styles.list}>
          {owned.map((o) => (
            <TitleCard
              key={o.key}
              def={o.def}
              groupName={o.groupName}
              selected={shown.includes(o.key)}
              onPress={() => toggle(o.key)}
            />
          ))}
        </View>
      )}

      {CATEGORY_ORDER.map((category) => {
        const titles = locked.filter((t) => t.category === category);
        if (titles.length === 0) return null;
        return (
          <View key={category} style={styles.list}>
            <SectionTitle>Still to unlock: {CATEGORY_NAMES[category]}</SectionTitle>
            {titles.map((t) => (
              <TitleCard key={t.id} def={t} locked />
            ))}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
});
