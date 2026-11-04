import { HONG_KONG_DEFAULTS, HongKongConfig } from '../hongKong';
import type { PatternDef, PaymentRules, Ruleset } from '../types';
import { houseRules } from './houseRules';
import {
  HONG_KONG_NEVER_TOGETHER,
  HONG_KONG_REPLACES,
  HONG_KONG_RULE_CHOICES,
  HONG_KONG_SETTINGS,
  HONG_KONG_TABLE,
} from './hongKongConfig';

export const HONG_KONG_ID = 'hongkong';

/** Patterns that depend on how the hand was won, which the player says; the tiles show the rest. */
const SITUATIONS = ['kong_replacement', 'robbing_kong', 'last_tile', 'heavenly_hand', 'earthly_hand'];

const REQUIRES: Record<string, PatternDef['requires']> = {
  self_drawn: { winType: 'selfDraw' },
  kong_replacement: { winType: 'selfDraw' },
  robbing_kong: { winType: 'discard' },
  last_tile: { winType: 'selfDraw' },
  heavenly_hand: { winType: 'selfDraw', dealer: true },
  earthly_hand: { winType: 'discard', dealer: false },
  all_eight_flowers: { winType: 'selfDraw' },
  seven_robbing_one: { winType: 'discard' },
  ...(HONG_KONG_RULE_CHOICES.concealedSelfDrawScoresConcealed ? {} : { concealed: { winType: 'discard' } }),
};

// Patterns that are never scored together, for picking patterns by hand. Built from the same
// rules the detector uses.
const pairs: [string, string][] = [
  ...HONG_KONG_NEVER_TOGETHER,
  ...HONG_KONG_REPLACES,
  ...(HONG_KONG_RULE_CHOICES.dragonPungsStackWithThreeDragons
    ? []
    : ([
        ['dragon_pung', 'small_three_dragons'],
        ['dragon_pung', 'great_three_dragons'],
      ] as [string, string][])),
  ...(HONG_KONG_RULE_CHOICES.windPungsStackWithSmallFourWinds
    ? []
    : ([
        ['seat_wind', 'small_four_winds'],
        ['prevailing_wind', 'small_four_winds'],
      ] as [string, string][])),
];

const patterns: PatternDef[] = HONG_KONG_TABLE.map((e) => ({
  id: e.id,
  name: e.name,
  chinese: e.chinese,
  tai: e.faan === 'LIMIT' ? 0 : e.faan,
  limit: e.faan === 'LIMIT',
  maxCount: e.maxCount,
  group: e.group,
  description: e.notes,
  fromTiles: !SITUATIONS.includes(e.id),
  requires: REQUIRES[e.id],
  excludes: pairs.filter(([a]) => a === e.id).map(([, b]) => b),
}));

/** Hong Kong rules, built from hongKongConfig.ts. Payment settings can still change per game. */
export const hongKongRules: Ruleset = {
  id: HONG_KONG_ID,
  name: 'Hong Kong',
  description: 'Hong Kong faan scoring, with flowers and no animals.',
  scoringModel: 'tai',
  unit: 'faan',
  handSize: 13,
  groupNames: { limit: 'Limit hands' },
  payment: {
    basePoints: HONG_KONG_SETTINGS.basePerFaan,
    minTai: HONG_KONG_SETTINGS.minFaanToWin,
    maxTai: HONG_KONG_SETTINGS.payoutCapFaan,
    limitTai: HONG_KONG_SETTINGS.limitFaan,
    payoutCapOnly: true,
    // Who pays how much, and the false-win penalty, follow House. Note 自摸 scores a faan and
    // the self-draw multiplier applies too.
    discard: houseRules.payment.discard,
    selfDrawMultiplier: houseRules.payment.selfDrawMultiplier,
    falseWinPoints: houseRules.payment.falseWinPoints,
  },
  // The same immediate payouts as House: kongs, flower pairs and flower kongs.
  immediatePayouts: houseRules.immediatePayouts,
  rotation: houseRules.rotation,
  patterns,
};

/** The detector's config for one game, with the cap and minimum chosen when it started. */
export function hongKongConfigFor(payment: PaymentRules): HongKongConfig {
  return {
    ...HONG_KONG_DEFAULTS,
    settings: { ...HONG_KONG_DEFAULTS.settings, payoutCapFaan: payment.maxTai, minFaanToWin: payment.minTai, basePerFaan: payment.basePoints },
  };
}
