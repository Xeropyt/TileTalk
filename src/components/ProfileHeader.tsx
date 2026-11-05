import React, { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { ProfileThemeDef } from '../game/profileThemes';
import { radius } from '../theme';

const FONTS = {
  sans: undefined,
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, Consolas, monospace' }),
};

/**
 * The top of a public profile, in the player's chosen design: background, avatar frame and name.
 * Its colours come from the design, not the app theme, so every visitor sees the same thing.
 */
export function ProfileHeader({
  theme,
  avatar,
  name,
  subtitle,
  compact,
  children,
}: {
  theme: ProfileThemeDef;
  avatar: string;
  name: string;
  subtitle?: string;
  /** Smaller, for previews. */
  compact?: boolean;
  children?: ReactNode;
}) {
  const look = theme.look;
  const avatarSize = compact ? 56 : 96;
  const frame = (compact ? 0.6 : 1) * look.frameWidth;
  return (
    <View
      style={[styles.card, { backgroundColor: look.background, borderColor: look.border }, compact && styles.compact]}
      accessibilityLabel={`${name}'s profile, ${theme.name} design`}
    >
      <View style={[styles.band, { backgroundColor: look.band }]} />
      {look.ornament ? (
        <>
          <Text style={[styles.ornament, styles.left, { color: look.ornamentColor }, compact && styles.ornamentSmall]}>{look.ornament}</Text>
          <Text style={[styles.ornament, styles.right, { color: look.ornamentColor }, compact && styles.ornamentSmall]}>{look.ornament}</Text>
        </>
      ) : null}
      <View
        style={{
          width: avatarSize + frame * 2,
          height: avatarSize + frame * 2,
          borderRadius: (avatarSize + frame * 2) / 2,
          borderWidth: frame,
          borderColor: look.frame,
          backgroundColor: look.avatarBackground,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: avatarSize * 0.55, lineHeight: avatarSize * 0.7 }}>{avatar}</Text>
      </View>
      <Text
        style={[
          styles.name,
          compact && styles.nameSmall,
          {
            color: look.name,
            fontFamily: FONTS[look.font],
            letterSpacing: look.tracking,
            textTransform: look.uppercase ? 'uppercase' : 'none',
          },
        ]}
        numberOfLines={1}
      >
        {name}
      </Text>
      {subtitle ? <Text style={[styles.subtitle, { color: look.subtitle }]}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

// Fixed sizes only: colours come from the profile design.
const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderRadius: radius.card + 4,
    borderWidth: 2,
    overflow: 'hidden',
  },
  compact: { paddingVertical: 14, gap: 6, borderRadius: radius.card },
  band: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%' },
  ornament: { position: 'absolute', top: 10, fontSize: 22, opacity: 0.9 },
  ornamentSmall: { fontSize: 15, top: 6 },
  left: { left: 14 },
  right: { right: 14 },
  name: { fontSize: 24, fontWeight: '800', maxWidth: '90%' },
  nameSmall: { fontSize: 16 },
  subtitle: { fontSize: 14, fontWeight: '600' },
});
