import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { CATEGORY_NAMES, Progress, RARITY_NAMES, TitleDef, TitleRarity } from '../game/titles';
import { colors, radius, themedStyles } from '../theme';
import { ProgressBar } from '../ui';

// Read at render time, so it follows the app theme.
const rarityColor = (rarity: TitleRarity): string =>
  ({ common: colors.textMuted, rare: colors.secondary, legendary: colors.accent })[rarity];

/** A title as a card: name, rarity, and how it's unlocked. */
export function TitleCard({
  def,
  groupName,
  locked,
  selected,
  progress,
  onPress,
}: {
  def: TitleDef;
  groupName?: string;
  locked?: boolean;
  selected?: boolean;
  /** How close a locked title is. */
  progress?: Progress;
  onPress?: () => void;
}) {
  const styles = useStyles();
  const accent = rarityColor(def.rarity);
  const body = (
    <>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.text}>
        <View style={styles.header}>
          <Text style={styles.name}>
            {def.name}
            {def.chinese ? `  ${def.chinese}` : ''}
          </Text>
          {selected ? <Text style={styles.showing}>Showing</Text> : null}
        </View>
        <Text style={[styles.meta, { color: accent }]}>
          {RARITY_NAMES[def.rarity]} {CATEGORY_NAMES[def.category].toLowerCase()} title
          {def.held ? (groupName ? `, held in ${groupName}` : ', held by one player per group') : ''}
        </Text>
        <Text style={styles.unlock}>{def.unlock}</Text>
        {progress ? <ProgressBar fraction={progress.fraction} text={progress.text} /> : null}
      </View>
    </>
  );
  // Locked titles with a progress bar stay readable; the bar shows they're not earned yet.
  const style = [styles.card, selected && styles.cardSelected, locked && !progress && styles.locked];
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [...style, pressed && { opacity: 0.8 }]}
    >
      {body}
    </Pressable>
  );
}

/** A one-line title, e.g. under a name on the leaderboard. Pass `color` on light backgrounds. */
export function TitleBadge({ def, color }: { def: TitleDef; color?: string }) {
  const styles = useStyles();
  return (
    <Text style={[styles.badge, { color: color ?? rarityColor(def.rarity) }]} numberOfLines={1}>
      ★ {def.name}
    </Text>
  );
}

const useStyles = themedStyles((colors) => ({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardSelected: { borderColor: colors.highlight, borderWidth: 2 },
  locked: { opacity: 0.5 },
  accent: { width: 6 },
  text: { flex: 1, padding: 12, gap: 3 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  showing: {
    color: colors.onHighlight,
    backgroundColor: colors.highlight,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  meta: { fontSize: 13, fontWeight: '600' },
  unlock: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  badge: { fontSize: 13, fontWeight: '700' },
}));
