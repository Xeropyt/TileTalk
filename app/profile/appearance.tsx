import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { APP_THEMES, AppTheme, radius, setAppTheme, themedStyles, useAppTheme } from '../../src/theme';
import { Muted, Screen } from '../../src/ui';

/** Pick how TileTalk looks on this device. Saved here only: nobody else sees it. */
export default function AppearancePage() {
  const styles = useStyles();
  const current = useAppTheme();
  return (
    <Screen>
      <Muted>Changes how TileTalk looks on this device only. It isn’t saved to your account, and nobody else sees it.</Muted>
      <View style={styles.list}>
        {APP_THEMES.map((t) => (
          <ThemeCard key={t.id} theme={t} selected={t.id === current.id} />
        ))}
      </View>
    </Screen>
  );
}

function ThemeCard({ theme, selected }: { theme: AppTheme; selected: boolean }) {
  const styles = useStyles();
  const c = theme.colors;
  const swatches = [c.background, c.surface, c.primary, c.secondary, c.accent, c.highlight, c.text];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${theme.name}. ${theme.description}`}
      onPress={() => setAppTheme(theme.id)}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && { opacity: 0.85 }]}
    >
      {/* A small version of the app in this theme's own colours. */}
      <View style={[styles.preview, { backgroundColor: c.background, borderColor: c.border }]}>
        <View style={[styles.previewBar, { backgroundColor: c.surfaceDeep }]}>
          <Text style={[styles.previewTitle, { color: c.text }]}>TileTalk</Text>
          <View style={[styles.previewDot, { backgroundColor: c.primary }]} />
        </View>
        <View style={[styles.previewCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[styles.previewTile, { backgroundColor: c.tileFace, borderBottomColor: c.tileEdge }]}>
            <Text style={{ color: c.tileRed, fontSize: 13, fontWeight: '800' }}>中</Text>
          </View>
          <View style={styles.previewLines}>
            <Text style={[styles.previewLine, { color: c.text }]}>All pungs</Text>
            <Text style={[styles.previewSub, { color: c.textMuted }]}>Amy won, +16</Text>
          </View>
          <Text style={[styles.previewBadge, { backgroundColor: c.accent, color: c.onAccent }]}>3 tai</Text>
        </View>
        <View style={[styles.previewButton, { backgroundColor: c.primary }]}>
          <Text style={[styles.previewButtonText, { color: c.onPrimary }]}>Record hand</Text>
        </View>
      </View>

      <View style={styles.info}>
        <View style={styles.header}>
          <Text style={styles.name}>{theme.name}</Text>
          {selected ? (
            <Text style={styles.selected}>✓ In use</Text>
          ) : (
            <View style={styles.radio} accessibilityElementsHidden importantForAccessibility="no" />
          )}
        </View>
        <Text style={styles.description}>{theme.description}</Text>
        <View style={styles.swatches}>
          {swatches.map((s, i) => (
            <View key={i} style={[styles.swatch, { backgroundColor: s }]} />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = themedStyles((colors) => ({
  list: { gap: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 12,
  },
  cardSelected: { borderColor: colors.highlight, borderWidth: 2 },
  preview: { borderRadius: radius.control, borderWidth: 1, padding: 10, gap: 8, overflow: 'hidden' },
  previewBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  previewTitle: { fontSize: 13, fontWeight: '800' },
  previewDot: { width: 10, height: 10, borderRadius: 5 },
  previewCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 1, padding: 8 },
  previewTile: { width: 22, height: 29, borderRadius: 4, borderBottomWidth: 3, alignItems: 'center', justifyContent: 'center' },
  previewLines: { flex: 1 },
  previewLine: { fontSize: 13, fontWeight: '700' },
  previewSub: { fontSize: 11 },
  previewBadge: { fontSize: 11, fontWeight: '800', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  previewButton: { borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  previewButtonText: { fontSize: 12, fontWeight: '700' },
  info: { gap: 6, paddingHorizontal: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
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
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border },
  description: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  swatches: { flexDirection: 'row', gap: 6, paddingTop: 2 },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.border },
}));
