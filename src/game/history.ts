import { findPattern } from '../scoring/engine';
import type { ClaimedPattern, PatternGroup, Ruleset } from '../scoring/types';
import type { PayoutRecord, Player } from '../types';

// The hand's big features first, flowers last: "All pungs + Dragon pung + Own flower".
const GROUP_ORDER: PatternGroup[] = ['limit', 'shape', 'sets', 'winning', 'bonus'];

/** What a winning hand was, from its patterns, e.g. "All pungs + Dragon pung ×2 + Own flower". */
export function handName(ruleset: Ruleset, patterns: ClaimedPattern[]): string | null {
  const parts = patterns
    .filter((c) => c.count > 0)
    .map((c) => ({ c, def: findPattern(ruleset, c.id), index: ruleset.patterns.findIndex((p) => p.id === c.id) }))
    .filter((x) => x.def)
    .sort((a, b) => GROUP_ORDER.indexOf(a.def!.group) - GROUP_ORDER.indexOf(b.def!.group) || a.index - b.index)
    .map(({ c, def }) => `${def!.shortName ?? def!.name}${c.count > 1 ? ` ×${c.count}` : ''}`);
  return parts.length ? parts.join(' + ') : null;
}

export interface PayoutTotals {
  playerId: string;
  earned: number;
  lost: number;
  net: number;
}

/** Each player's immediate payouts added up, in seat order. Lost is a positive number. */
export function payoutTotals(players: Player[], payouts: PayoutRecord[]): PayoutTotals[] {
  return players.map((p) => {
    let earned = 0;
    let lost = 0;
    for (const record of payouts) {
      const delta = record.payments[p.id] ?? 0;
      if (delta > 0) earned += delta;
      else lost -= delta;
    }
    return { playerId: p.id, earned, lost, net: earned - lost };
  });
}

/** "1:05:09" while a game runs. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return h ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
}

/** "1h 5m" in the history. */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
