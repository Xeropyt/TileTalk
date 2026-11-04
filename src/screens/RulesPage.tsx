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
  unitOf,
} from '../scoring';
import { colors, radius } from '../theme';
import { Chip, Field, Muted, Row, SectionTitle, Title } from '../ui';
import { TabPage } from './TabPage';

const GROUP_ORDER: PatternGroup[] = ['bonus', 'sets', 'shape', 'winning', 'limit'];
// Riichi: yaku first, then dora (which only count alongside a yaku), then yakuman.
const HAN_FU_GROUP_ORDER: PatternGroup[] = ['winning', 'sets', 'shape', 'bonus', 'limit'];

export function RulesPage() {
  const [rulesetId, setRulesetId] = usePreferredRuleset();
  const [search, setSearch] = useState('');
  const ruleset = getRuleset(rulesetId);
  const term = search.trim().toLowerCase();
  const matches = (p: PatternDef) =>
    !term || [p.name, p.chinese ?? '', p.description ?? ''].some((t) => t.toLowerCase().includes(term));
  const payouts = ruleset.immediatePayouts.filter(
    (d) => !term || ['immediate payout', d.name, d.chinese ?? '', d.description].some((t) => t.toLowerCase().includes(term)),
  );
  const isRiichi = ruleset.scoringModel === 'hanFu';
  const showFalseWin =
    !isRiichi && (!term || ['false win', 'za-hu', 'zahu', '詐胡', 'penalty'].some((t) => t.includes(term) || term.includes(t)));
  const notes = (ruleset.notes ?? []).filter((n) => !term || `${n.title} ${n.body}`.toLowerCase().includes(term));

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
      {isRiichi ? (
        <Muted>
          {ruleset.name}: {ruleset.description} Han values are shown closed / open; “closed only” yaku need a closed hand. Game
          length, uma, three players and more can be set for each game when you start it.
        </Muted>
      ) : (
        <Muted>
          {ruleset.name}: {ruleset.description} {ruleset.payment.payoutCapOnly ? 'Payouts are' : 'Hands are'} capped at{' '}
          {ruleset.payment.maxTai} {unitOf(ruleset)}, and you need at least{' '}
          {ruleset.payment.minTai} to win.
          {ruleset.payment.limitTai ? ` Limit hands count as ${ruleset.payment.limitTai} ${unitOf(ruleset)} and pay the max.` : ''} The
          min and max {unitOf(ruleset)}, three or four players, and who pays for a discard can be
          changed for each game when you start it.
        </Muted>
      )}

      <Field label="Search" value={search} onChangeText={setSearch} placeholder="e.g. flush, 平胡, dragons" />

      {(isRiichi ? HAN_FU_GROUP_ORDER : GROUP_ORDER).map((group) => {
        const patterns = ruleset.patterns.filter((p) => p.group === group && matches(p));
        if (patterns.length === 0) return null;
        return (
          <View key={group} style={styles.group}>
            <SectionTitle>{ruleset.groupNames?.[group] ?? PATTERN_GROUP_NAMES[group]}</SectionTitle>
            {patterns.map((p) => (
              <PatternEntry key={p.id} ruleset={ruleset} pattern={p} />
            ))}
          </View>
        );
      })}
      {payouts.length > 0 ? (
        <View style={styles.group}>
          <SectionTitle>Immediate payouts</SectionTitle>
          <Muted>Paid the moment they happen, whoever goes on to win the hand. Record them on the game screen.</Muted>
          {payouts.map((d) => (
            <View key={d.id} style={styles.entry}>
              <View style={styles.entryHeader}>
                <Text style={styles.entryName}>
                  {d.name}
                  {d.chinese ? `  ${d.chinese}` : ''}
                </Text>
                <Text style={styles.badge}>
                  {d.payer === 'others'
                    ? `+${d.amount} from each`
                    : d.payer === 'discarder'
                      ? `+${d.amount} from discarder`
                      : `+${d.amount} from owner, +${d.amount * 3} if yours`}
                </Text>
              </View>
              <Muted>{d.description}</Muted>
            </View>
          ))}
        </View>
      ) : null}
      {showFalseWin ? (
        <View style={styles.group}>
          <SectionTitle>Penalties</SectionTitle>
          <View style={styles.entry}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryName}>False win  詐胡</Text>
              <Text style={[styles.badge, styles.badgeLimit]}>−{falseWinPenalty(ruleset.payment)} to each player</Text>
            </View>
            <Muted>
              Declaring a win with a hand that isn’t complete, or doesn’t reach {ruleset.payment.minTai} {unitOf(ruleset)}. You pay each
              other player the max {unitOf(ruleset)} in points ({falseWinPenalty(ruleset.payment)} with a {ruleset.payment.maxTai}-
              {unitOf(ruleset)} cap).
              The hand is then replayed and the deal doesn’t move. Record it with False win on the Record hand screen.
            </Muted>
          </View>
        </View>
      ) : null}
      {notes.length > 0 ? (
        <View style={styles.group}>
          <SectionTitle>How it works</SectionTitle>
          {notes.map((n) => (
            <View key={n.title} style={styles.entry}>
              <Text style={styles.entryName}>{n.title}</Text>
              <Muted>{n.body}</Muted>
            </View>
          ))}
        </View>
      ) : null}
      {ruleset.patterns.every((p) => !matches(p)) && payouts.length === 0 && !showFalseWin && notes.length === 0 ? <Muted>No hands match “{search.trim()}”.</Muted> : null}
    </TabPage>
  );
}

/** e.g. "2 tai", "Limit (5 tai)", "2 han / 1 open", "1 han, closed only" or "Yakuman". */
function patternValue(ruleset: Ruleset, p: PatternDef): string {
  const each = (p.maxCount ?? 1) > 1 ? ' each' : '';
  const unit = unitOf(ruleset);
  if (ruleset.scoringModel !== 'hanFu') return p.limit ? `Limit (${ruleset.payment.limitTai ?? ruleset.payment.maxTai} ${unit})` : `${p.tai} ${unit}${each}`;
  if (p.limit) return p.openTai === null ? 'Yakuman, closed only' : 'Yakuman';
  if (p.openTai === null) return `${p.tai} han${each}, closed only`;
  if (p.openTai !== undefined && p.openTai !== p.tai) return `${p.tai} han / ${p.openTai} open`;
  return `${p.tai} han${each}`;
}

function PatternEntry({ ruleset, pattern: p }: { ruleset: Ruleset; pattern: PatternDef }) {
  const [open, setOpen] = useState(false);
  const clashes = clashesWith(ruleset, p.id);
  const value = patternValue(ruleset, p);

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
