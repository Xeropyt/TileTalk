import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { displayNameOf, Protected, useAuth, useSignedInUser } from '../auth';
import { StatsGrid } from '../components/StatsGrid';
import { TitleCard } from '../components/TitleCard';
import { updateProfile } from '../db';
import { ownedTitles, shownTitles, TITLES } from '../game/titles';
import { usePlayerRecord, usePublishRecord } from '../stats';
import { findAppTheme, radius, themedStyles, useAppTheme } from '../theme';
import { findProfileTheme } from '../game/profileThemes';
import { Button, Card, ErrorText, Field, Loading, Muted, SectionTitle, Title } from '../ui';
import { TabPage } from './TabPage';

export function ProfilePage() {
  return (
    <Protected>
      <ProfileContent />
    </Protected>
  );
}

function ProfileContent() {
  const styles = useStyles();
  const user = useSignedInUser();
  const { profile, isGuest, signOut } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmLogOut, setConfirmLogOut] = useState(false);
  const appTheme = useAppTheme();
  const { record, error: recordError } = usePlayerRecord(user.uid);
  // This page is always mounted under the tab bar, so it keeps the public copy up to date.
  usePublishRecord(profile, record, !isGuest);

  useEffect(() => {
    if (profile) setName(profile.displayName);
  }, [profile?.displayName]);

  if (!profile) return <Loading />;
  const shown = shownTitles(profile);
  const earnedCount = ownedTitles(profile).length;

  const saveName = async () => {
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await updateProfile(user.uid, { displayName: name.trim() });
      setMessage('Name saved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <TabPage>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change your avatar"
          onPress={() => router.push('/profile/avatar')}
          style={({ pressed }) => [styles.avatarButton, pressed && { opacity: 0.75 }]}
        >
          <Text style={styles.avatar}>{profile.avatar}</Text>
          <Text style={styles.avatarHint}>Change</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Title>{displayNameOf(profile)}</Title>
          {isGuest ? <Muted>Guest</Muted> : <Muted>{user.email}</Muted>}
        </View>
      </View>

      <View style={styles.custom}>
        <SettingRow
          icon="🎨"
          title="App theme"
          value={findAppTheme(appTheme.id).name}
          hint="How TileTalk looks on this device"
          onPress={() => router.push('/profile/appearance')}
        />
        <SettingRow
          icon="🪪"
          title="Profile customisation"
          value={findProfileTheme(profile.profileTheme).name}
          hint="The design everyone sees on your profile"
          onPress={() => router.push('/profile/customise')}
        />
      </View>

      {isGuest ? (
        <Card>
          <SectionTitle>Playing as a guest</SectionTitle>
          <Muted>
            Your games and stats are saved, but only on this device. Create an account to keep them if you switch phones,
            and to appear on the leaderboard.
          </Muted>
          <Button title="Create account" onPress={() => router.push('/login?mode=signup')} />
          <Button title="I already have an account" variant="secondary" onPress={() => router.push('/login')} />
        </Card>
      ) : null}

      <SectionTitle>Your titles</SectionTitle>
      {shown.length === 0 ? (
        <Muted>
          {earnedCount === 0
            ? 'Earn titles by playing, then pick up to three to show on your public profile.'
            : 'You’ve earned titles. Pick up to three to show on your public profile.'}
        </Muted>
      ) : (
        <View style={styles.list}>
          {shown.map((t) => (
            <TitleCard key={t.key} def={t.def} groupName={t.groupName} />
          ))}
        </View>
      )}
      <Button
        title={`All titles (${earnedCount} of ${TITLES.length} earned)`}
        variant="secondary"
        onPress={() => router.push('/profile/titles')}
      />
      <Button
        title="See your public profile"
        variant="secondary"
        onPress={() => router.push({ pathname: '/player/[uid]', params: { uid: user.uid } })}
      />

      <SectionTitle>Career stats</SectionTitle>
      <Muted>From every game you’ve played that’s still in your history. Deleting a game removes it.</Muted>
      <ErrorText message={recordError} />
      {record ? <StatsGrid stats={record.stats} /> : <Loading />}

      <Card>
        <SectionTitle>Name</SectionTitle>
        <Field label="Display name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Button
          title="Save name"
          onPress={saveName}
          disabled={!name.trim() || name.trim() === profile.displayName}
          loading={saving}
        />
        {message ? <Muted>{message}</Muted> : null}
        <ErrorText message={error} />
      </Card>

      {isGuest ? null : (
        <Button
          title={confirmLogOut ? 'Tap again to log out' : 'Log out'}
          variant="secondary"
          onPress={async () => {
            if (!confirmLogOut) return setConfirmLogOut(true);
            setConfirmLogOut(false);
            await signOut();
          }}
        />
      )}
    </TabPage>
  );
}

/** A row that opens a settings screen, showing what's chosen now. */
function SettingRow({ icon, title, value, hint, onPress }: { icon: string; title: string; value: string; hint: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${value}`}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.setting, pressed && { opacity: 0.8 }]}
    >
      <Text style={styles.settingIcon}>{icon}</Text>
      <View style={styles.settingText}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingHint}>{hint}</Text>
      </View>
      <Text style={styles.settingValue} numberOfLines={1}>
        {value} ›
      </Text>
    </Pressable>
  );
}

const useStyles = themedStyles((colors) => ({
  custom: { gap: 10 },
  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 60,
  },
  settingIcon: { fontSize: 24 },
  settingText: { flex: 1, gap: 1 },
  settingTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  settingHint: { color: colors.textMuted, fontSize: 13 },
  settingValue: { color: colors.highlight, fontSize: 14, fontWeight: '700', maxWidth: 130 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerText: { flex: 1, gap: 2 },
  avatarButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { fontSize: 44, lineHeight: 52 },
  avatarHint: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  list: { gap: 10 },
}));
