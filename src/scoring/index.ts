import { RIICHI_DEFAULTS } from './riichi';
import { hongKongRules } from './rulesets/hongKong';
import { houseRules } from './rulesets/houseRules';
import { riichiRules } from './rulesets/riichi';
import type { GameOptions, RiichiOptions, Ruleset } from './types';

// Add new rulesets (Hong Kong, Singapore, Taiwanese, MCR...) to this list.
export const RULESETS: Ruleset[] = [houseRules, hongKongRules, riichiRules];

export function getRuleset(id: string): Ruleset {
  return RULESETS.find((r) => r.id === id) ?? houseRules;
}

/** A game's ruleset with the house rules chosen when it started. Older games have none. */
export function rulesetFor(id: string, options?: Partial<GameOptions> | null): Ruleset {
  const base = getRuleset(id);
  if (!options) return base;
  return {
    ...base,
    payment: {
      ...base.payment,
      maxTai: options.maxTai ?? base.payment.maxTai,
      minTai: options.minTai ?? base.payment.minTai,
      discard: options.discard ?? base.payment.discard,
    },
  };
}

/** The settings a new game starts with, before anyone changes them. */
export function defaultOptions(ruleset: Ruleset, players: 3 | 4 = 4): GameOptions {
  return {
    maxTai: ruleset.payment.maxTai,
    minTai: ruleset.payment.minTai,
    discard: ruleset.payment.discard,
    players,
    ...(ruleset.riichiDefaults ? { riichi: ruleset.riichiDefaults[players] } : {}),
  };
}

/** A Riichi game's settings, falling back to the ruleset's defaults. */
export function riichiOptionsOf(ruleset: Ruleset, options: Partial<GameOptions> | null | undefined, players: number): RiichiOptions {
  const defaults = ruleset.riichiDefaults?.[players === 3 ? 3 : 4] ?? RIICHI_DEFAULTS[players === 3 ? 3 : 4];
  return { ...defaults, ...options?.riichi };
}

/** What a ruleset calls its hand values: "tai", "faan" or "han". */
export function unitOf(ruleset: Ruleset): string {
  return ruleset.scoringModel === 'hanFu' ? 'han' : (ruleset.unit ?? 'tai');
}

/** A hand's value in the ruleset's own units, e.g. "3 tai", "3 faan", "4 han" or "Yakuman". */
export function formatHandValue(rulesetId: string, value: number): string {
  const ruleset = getRuleset(rulesetId);
  if (ruleset.scoringModel !== 'hanFu') return `${value} ${unitOf(ruleset)}`;
  if (value >= 13) return value >= 26 ? `${Math.floor(value / 13)}× yakuman` : 'Yakuman';
  return `${value} han`;
}

export const PATTERN_GROUP_NAMES: Record<string, string> = {
  bonus: 'Flowers',
  sets: 'Sets',
  shape: 'Hand shape',
  winning: 'How you won',
  limit: 'Limit hands',
};

export * from './engine';
export * from './hongKong';
export { HONG_KONG_ID, hongKongConfigFor } from './rulesets/hongKong';
export * from './riichi';
export * from './tileHand';
export * from './types';
