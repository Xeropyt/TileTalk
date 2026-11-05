import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Protected, useAuth, useSignedInUser } from '../../src/auth';
import { TitleCard } from '../../src/components/TitleCard';
import { updateProfile } from '../../src/db';
import { sortByProgress } from '../../src/game/profileThemes';
import { CATEGORY_NAMES, MAX_SHOWN_TITLES, ownedTitles, shownTitles, TitleCategory, TITLES } from '../../src/game/titles';
import { usePlayerRecord } from '../../src/stats';
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
  const { record } = usePlayerRecord(user.uid);

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
        {MAX_SHOWN_TITLES}. Titles still to unlock show how close you are, closest first.
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
        // Closest to unlocking first, within each category.
        const titles = sortByProgress(
          locked.filter((t) => t.category === category),
          (t) => record?.progress[t.id]?.fraction ?? 0,
        );
        if (titles.length === 0) return null;
        return (
          <View key={category} style={styles.list}>
            <SectionTitle>Still to unlock: {CATEGORY_NAMES[category]}</SectionTitle>
            {titles.map((t) => (
              <TitleCard key={t.id} def={t} locked progress={record?.progress[t.id]} />
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
