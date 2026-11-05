import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { displayNameOf, Protected, useAuth, useSignedInUser } from '../../src/auth';
import { ProfileHeader } from '../../src/components/ProfileHeader';
import { updateProfile } from '../../src/db';
import { findProfileTheme, PROFILE_THEMES, profileThemeStatus, ProfileThemeDef, ProfileThemeStatus, sortByProgress } from '../../src/game/profileThemes';
import { shownTitles } from '../../src/game/titles';
import { useUnlocks } from '../../src/stats';
import { radius, themedStyles } from '../../src/theme';
import { ErrorText, Loading, Muted, ProgressBar, Screen, SectionTitle } from '../../src/ui';

export default function CustomisePage() {
  return (
    <Protected>
      <CustomiseScreen />
    </Protected>
  );
}

/** Choose the design everyone sees on your public profile. Some unlock by playing. */
function CustomiseScreen() {
  const styles = useStyles();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const { counts, isAdmin } = useUnlocks(user.uid);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!profile || !counts) return <Loading />;
  const current = findProfileTheme(profile.profileTheme).id;
  const status = (t: ProfileThemeDef) => profileThemeStatus(t, counts, isAdmin);
  const ordered = sortByProgress(PROFILE_THEMES, (t) => (status(t).unlocked ? 1 : (status(t).progress?.fraction ?? 0)));
  const title = shownTitles(profile)[0]?.def.name;

  const choose = async (t: ProfileThemeDef) => {
    if (!status(t).unlocked || t.id === current) return;
    setSaving(t.id);
    setError(null);
    try {
      await updateProfile(user.uid, { profileTheme: t.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Screen>
      <Muted>
        Everyone who opens your profile sees this design.{' '}
        {isAdmin ? 'As an admin, every design is unlocked for you.' : 'Some unlock as you play, closest first.'}
      </Muted>
      <ErrorText message={error} />
      <SectionTitle>Profile designs</SectionTitle>
      <View style={styles.list}>
        {ordered.map((t) => (
          <DesignCard
            key={t.id}
            theme={t}
            status={status(t)}
            selected={t.id === current}
            saving={saving === t.id}
            name={displayNameOf(profile)}
            avatar={profile.avatar}
            subtitle={title}
            onPress={() => choose(t)}
          />
        ))}
      </View>
    </Screen>
  );
}

function DesignCard({
  theme,
  status,
  selected,
  saving,
  name,
  avatar,
  subtitle,
  onPress,
}: {
  theme: ProfileThemeDef;
  status: ProfileThemeStatus;
  selected: boolean;
  saving: boolean;
  name: string;
  avatar: string;
  subtitle?: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const locked = !status.unlocked;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: locked }}
      accessibilityLabel={`${theme.name}${locked ? `, locked. ${theme.unlock?.label}` : ''}`}
      onPress={onPress}
      disabled={locked}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && { opacity: 0.85 }]}
    >
      <View style={locked && styles.lockedPreview}>
        <ProfileHeader theme={theme} avatar={avatar} name={name} subtitle={subtitle} compact />
      </View>
      <View style={styles.header}>
        <Text style={styles.name}>
          {locked ? '🔒 ' : ''}
          {theme.name}
        </Text>
        {selected ? <Text style={styles.selected}>✓ Showing</Text> : saving ? <Muted>Saving…</Muted> : locked ? null : <Text style={styles.use}>Use</Text>}
      </View>
      <Text style={styles.description}>{theme.description}</Text>
      {theme.unlock ? (
        <>
          <Text style={[styles.unlock, status.unlocked && styles.unlocked]}>
            {status.unlocked ? `Unlocked: ${theme.unlock.label.toLowerCase()}` : theme.unlock.label}
          </Text>
          {status.progress && !status.unlocked ? <ProgressBar fraction={status.progress.fraction} text={status.progress.text} /> : null}
        </>
      ) : (
        <Text style={styles.unlocked}>Free for everyone</Text>
      )}
    </Pressable>
  );
}

const useStyles = themedStyles((colors) => ({
  list: { gap: 14 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 },
  cardSelected: { borderColor: colors.highlight, borderWidth: 2 },
  lockedPreview: { opacity: 0.55 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 4 },
  name: { color: colors.text, fontSize: 17, fontWeight: '800' },
  selected: {
    color: colors.onHighlight,
    backgroundColor: colors.highlight,
    fontSize: 12,
    fontWeight: '800',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  use: { color: colors.text, fontSize: 13, fontWeight: '700', borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 3 },
  description: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  unlock: { color: colors.text, fontSize: 14, fontWeight: '600' },
  unlocked: { color: colors.success, fontSize: 14, fontWeight: '600' },
}));
