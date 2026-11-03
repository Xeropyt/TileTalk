import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePreferredRuleset } from '../preferences';
import {
  clashesWith,
  falseWinPenalty,
  findPattern,
  getRuleset,
  PATTERN_GROUP_NAMES,
  PatternDef,
  PatternGroup,
  Ruleset,
  RULESETS,
} from '../scoring';
import { colors, radius } from '../theme';
import { Chip, Field, Muted, Row, SectionTitle, Title } from '../ui';
import { TabPage } from './TabPage';

const GROUP_ORDER: PatternGroup[] = ['bonus', 'sets', 'shape', 'winning', 'limit'];

export function RulesPage() {
  const [rulesetId, setRulesetId] = usePreferredRuleset();
  const [search, setSearch] = useState('');
  const ruleset = getRuleset(rulesetId);
  const term = search.trim().toLowerCase();
  const matches = (p: PatternDef) =>
    !term || [p.name, p.chinese ?? '', p.description ?? ''].some((t) => t.toLowerCase().includes(term));
  const showFalseWin = !term || ['false win', 'za-hu', 'zahu', '詐胡', 'penalty'].some((t) => t.includes(term) || term.includes(t));

  return (
    <TabPage>
      <Title>Scoring hands</Title>
      <Muted>Every hand you can score, what it’s worth, and what it can’t be combined with.</Muted>

      {RULESETS.length > 1 ? (
        <Row>
          {RULESETS.map((r) => (
            <Chip key={r.id} label={r.name} selected={r.id === ruleset.id} onPress={() => setRulesetId(r.id)} />
          ))}
        </Row>
      ) : null}
      <Muted>
        {ruleset.name}: {ruleset.description} Hands are capped at {ruleset.payment.maxTai} tai, and you need at least{' '}
        {ruleset.payment.minTai} to win.
      </Muted>

      <Field label="Search" value={search} onChangeText={setSearch} placeholder="e.g. flush, 平胡, dragons" />

      {GROUP_ORDER.map((group) => {
        const patterns = ruleset.patterns.filter((p) => p.group === group && matches(p));
        if (patterns.length === 0) return null;
        return (
          <View key={group} style={styles.group}>
            <SectionTitle>{PATTERN_GROUP_NAMES[group]}</SectionTitle>
            {patterns.map((p) => (
              <PatternEntry key={p.id} ruleset={ruleset} pattern={p} />
            ))}
          </View>
        );
      })}
      {showFalseWin ? (
        <View style={styles.group}>
          <SectionTitle>Penalties</SectionTitle>
          <View style={styles.entry}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryName}>False win  詐胡</Text>
              <Text style={[styles.badge, styles.badgeLimit]}>−{falseWinPenalty(ruleset.payment)} to each player</Text>
            </View>
            <Muted>
              Declaring a win with a hand that isn’t complete, or doesn’t reach {ruleset.payment.minTai} tai. You pay each
              of the other three players {falseWinPenalty(ruleset.payment)}, the same as a {ruleset.payment.falseWinTai}-tai
              hand. The hand is then replayed and the deal doesn’t move. Record it with False win on the Record hand screen.
            </Muted>
          </View>
        </View>
      ) : null}
      {ruleset.patterns.every((p) => !matches(p)) && !showFalseWin ? <Muted>No hands match “{search.trim()}”.</Muted> : null}
    </TabPage>
  );
}

function PatternEntry({ ruleset, pattern: p }: { ruleset: Ruleset; pattern: PatternDef }) {
  const [open, setOpen] = useState(false);
  const clashes = clashesWith(ruleset, p.id);
  const value = p.limit ? `Limit (${ruleset.payment.maxTai} tai)` : `${p.tai} tai${(p.maxCount ?? 1) > 1 ? ' each' : ''}`;

  const notes: string[] = [];
  if ((p.maxCount ?? 1) > 1) notes.push(`Count it up to ${p.maxCount} times.`);
  if (p.requires?.winType) notes.push(p.requires.winType === 'selfDraw' ? 'Self-drawn wins only.' : 'Only off a discard.');
  if (p.requires?.dealer !== undefined) notes.push(p.requires.dealer ? 'Dealer only.' : 'Not for the dealer.');
  for (const [id, max] of Object.entries(p.caps ?? {})) {
    const other = findPattern(ruleset, id);
    if (other) notes.push(`${other.name} counts at most ${max === 1 ? 'once' : `${max} times`} with this.`);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityHint={open ? 'Hides the details' : 'Shows what this can’t be combined with'}
      onPress={() => setOpen(!open)}
      style={({ pressed }) => [styles.entry, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.entryHeader}>
        <Text style={styles.entryName}>
          {p.name}
          {p.chinese ? `  ${p.chinese}` : ''}
        </Text>
        <Text style={[styles.badge, p.limit && styles.badgeLimit]}>{value}</Text>
      </View>
      {p.description ? <Muted>{p.description}</Muted> : null}
      {open ? (
        <View style={styles.details}>
          {notes.map((n) => (
            <Text key={n} style={styles.detailText}>
              {n}
            </Text>
          ))}
          <Text style={styles.detailText}>
            {clashes.length === 0
              ? 'Combines with any other hand.'
              : `Can’t combine with: ${clashes.map((c) => c.name).join(', ')}.`}
          </Text>
        </View>
      ) : clashes.length > 0 || notes.length > 0 ? (
        <Muted style={styles.more}>Tap for details</Muted>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  entry: {
    backgroundColor: colors.feltRaised,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.feltLine,
    padding: 14,
    gap: 6,
  },
  entryHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  entryName: { color: colors.text, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  badge: {
    color: colors.ink,
    backgroundColor: colors.ivory,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
  },
  badgeLimit: { backgroundColor: colors.lacquer, color: colors.ivory },
  details: { gap: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.feltLine },
  detailText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  more: { fontSize: 13 },
});
