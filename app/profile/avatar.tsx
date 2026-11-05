import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AVATAR_GROUPS } from '../../src/avatars';
import { displayNameOf, Protected, useAuth, useSignedInUser } from '../../src/auth';
import { updateProfile } from '../../src/db';
import { radius, themedStyles } from '../../src/theme';
import { ErrorText, Loading, Muted, Screen, SectionTitle } from '../../src/ui';

export default function AvatarPage() {
  return (
    <Protected>
      <AvatarScreen />
    </Protected>
  );
}

function AvatarScreen() {
  const styles = useStyles();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (!profile) return <Loading />;

  const choose = async (avatar: string) => {
    setError(null);
    try {
      await updateProfile(user.uid, { avatar });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Screen>
      <View style={styles.current}>
        <Text style={styles.currentAvatar}>{profile.avatar}</Text>
        <Muted>{displayNameOf(profile)}. Tap any avatar to use it.</Muted>
      </View>
      <ErrorText message={error} />
      {AVATAR_GROUPS.map((g) => (
        <View key={g.name} style={styles.group}>
          <SectionTitle>{g.name}</SectionTitle>
          <View style={styles.grid}>
            {g.avatars.map((a) => (
              <Pressable
                key={a}
                accessibilityRole="button"
                accessibilityState={{ selected: profile.avatar === a }}
                accessibilityLabel={`Use ${a} as your avatar`}
                onPress={() => choose(a)}
                style={({ pressed }) => [styles.avatar, profile.avatar === a && styles.avatarSelected, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.avatarText}>{a}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const useStyles = themedStyles((colors) => ({
  current: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  currentAvatar: { fontSize: 72, lineHeight: 88 },
  group: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  avatarSelected: { backgroundColor: colors.highlight, borderColor: colors.highlight },
  avatarText: { fontSize: 28 },
}));
