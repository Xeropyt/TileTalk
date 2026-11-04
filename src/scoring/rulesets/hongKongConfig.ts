import type { PatternGroup } from '../types';

/**
 * The Hong Kong scoring table, as data. Edit faan values, settings and rule choices here; the
 * detector (scoring/hongKong.ts) and the Hong Kong ruleset read everything from this file.
 */

export type Faan = number | 'LIMIT';

export interface HongKongEntry {
  id: string;
  name: string;
  chinese: string;
  /** Per time it's counted. 'LIMIT' scores limitFaan and ignores every other pattern. */
  faan: Faan;
  notes: string;
  /** Where the pattern sits on the Rules page and the record screen. */
  group: PatternGroup;
  /** How many times it can count, e.g. 2 own flowers. Defaults to 1. */
  maxCount?: number;
}

export interface HongKongSettings {
  /** Payout = basePerFaan × 2^(faan − 1). */
  basePerFaan: number;
  /** What any limit hand scores. */
  limitFaan: number;
  /** Payout uses min(hand faan, this). The hand's own faan isn't capped. */
  payoutCapFaan: number;
  minFaanToWin: number;
  flowers: boolean;
  animals: boolean;
}

/** Rule choices that vary between rule sheets. Each default is the one agreed for this table. */
export interface HongKongRuleChoices {
  /** Dragon pungs add 1 each on top of small/great three dragons. Off: 5 and 8 are totals. */
  dragonPungsStackWithThreeDragons: boolean;
  /** Seat and prevailing wind pungs add on top of small four winds. */
  windPungsStackWithSmallFourWinds: boolean;
  /** 一台花 stacks with own-flower faan from the same set. */
  flowerSetStacksWithOwnFlower: boolean;
  /** Seven pairs combines with mixed one suit and full flush. */
  sevenPairsWithFlush: boolean;
  /** Seven pairs of honour tiles scores as all honours, a limit hand. */
  allHonoursSevenPairsIsLimit: boolean;
  /** A fully concealed self-drawn win scores 門前清 as well as 自摸. */
  concealedSelfDrawScoresConcealed: boolean;
  /** Seven pairs may use four of a kind as two pairs, as long as it's concealed and not declared as a kong. */
  sevenPairsAllowsFourOfAKind: boolean;
}

export const HONG_KONG_SETTINGS: HongKongSettings = {
  basePerFaan: 1,
  limitFaan: 13,
  payoutCapFaan: 13,
  minFaanToWin: 3,
  flowers: true,
  animals: false,
};

export const HONG_KONG_RULE_CHOICES: HongKongRuleChoices = {
  dragonPungsStackWithThreeDragons: false,
  windPungsStackWithSmallFourWinds: false,
  flowerSetStacksWithOwnFlower: true,
  sevenPairsWithFlush: true,
  allHonoursSevenPairsIsLimit: true,
  concealedSelfDrawScoresConcealed: false,
  sevenPairsAllowsFourOfAKind: true,
};

export const HONG_KONG_TABLE: HongKongEntry[] = [
  // 1 faan
  { id: 'self_drawn', name: 'Self-drawn win', chinese: '自摸', faan: 1, group: 'winning', notes: 'Win on a tile you drew yourself.' },
  {
    id: 'concealed',
    name: 'Concealed hand',
    chinese: '門前清',
    faan: 1,
    group: 'shape',
    notes: 'No melded sets (concealed kongs are fine), winning on a discard.',
  },
  { id: 'all_chows', name: 'All chows', chinese: '平糊', faan: 1, group: 'shape', notes: 'Four chows and a pair. Never with a pung or kong.' },
  { id: 'dragon_pung', name: 'Dragon pung', chinese: '番子', faan: 1, maxCount: 3, group: 'sets', notes: 'Pung or kong of a dragon. 1 per dragon pung.' },
  { id: 'seat_wind', name: 'Seat wind', chinese: '門風', faan: 1, group: 'sets', notes: 'Pung or kong of your seat wind.' },
  {
    id: 'prevailing_wind',
    name: 'Prevailing wind',
    chinese: '圈風',
    faan: 1,
    group: 'sets',
    notes: 'Pung or kong of the round wind. A wind that is both seat and prevailing scores both.',
  },
  { id: 'no_flowers', name: 'No flowers', chinese: '無花', faan: 1, group: 'bonus', notes: 'No flowers or seasons at all.' },
  {
    id: 'own_flower',
    name: 'Own flower',
    chinese: '正花',
    faan: 1,
    maxCount: 2,
    group: 'bonus',
    notes: 'The flower and season matching your seat (East 1, South 2, West 3, North 4). 1 each.',
  },
  { id: 'kong_replacement', name: 'Win on a kong replacement', chinese: '槓上開花', faan: 1, group: 'winning', notes: 'Win on the tile drawn after a kong.' },
  { id: 'robbing_kong', name: 'Robbing the kong', chinese: '搶槓', faan: 1, group: 'winning', notes: 'Win on the tile someone adds to their pung.' },
  { id: 'last_tile', name: 'Last tile of the wall', chinese: '海底撈月', faan: 1, group: 'winning', notes: 'Self-draw the last tile of the wall.' },
  {
    id: 'mixed_terminals',
    name: 'Mixed terminals',
    chinese: '混么九',
    faan: 1,
    group: 'shape',
    notes: 'Only 1s, 9s and honours. Stacks with all pungs (4 together).',
  },

  // Mid-value
  {
    id: 'flower_set',
    name: 'Complete set of flowers',
    chinese: '一台花',
    faan: 2,
    maxCount: 2,
    group: 'bonus',
    notes: 'All four flowers, or all four seasons. 2 per set.',
  },
  { id: 'all_pungs', name: 'All pungs', chinese: '對對糊', faan: 3, group: 'shape', notes: 'Four pungs or kongs and a pair.' },
  { id: 'mixed_one_suit', name: 'Mixed one suit', chinese: '混一色', faan: 3, group: 'shape', notes: 'One suit plus honours.' },
  { id: 'seven_pairs', name: 'Seven pairs', chinese: '七對子', faan: 4, group: 'shape', notes: 'House rule: seven pairs, fully concealed.' },
  { id: 'small_three_dragons', name: 'Small three dragons', chinese: '小三元', faan: 5, group: 'shape', notes: 'Two dragon pungs and a dragon pair.' },
  { id: 'small_four_winds', name: 'Small four winds', chinese: '小四喜', faan: 6, group: 'shape', notes: 'Three wind pungs and a wind pair.' },
  { id: 'full_flush', name: 'Full flush', chinese: '清一色', faan: 7, group: 'shape', notes: 'One suit, no honours.' },
  { id: 'great_three_dragons', name: 'Great three dragons', chinese: '大三元', faan: 8, group: 'shape', notes: 'Pungs or kongs of all three dragons.' },

  // Limit hands
  { id: 'thirteen_orphans', name: 'Thirteen orphans', chinese: '十三么', faan: 'LIMIT', group: 'limit', notes: 'One of every 1, 9, wind and dragon, plus one more of any.' },
  { id: 'great_four_winds', name: 'Great four winds', chinese: '大四喜', faan: 'LIMIT', group: 'limit', notes: 'Pungs or kongs of all four winds.' },
  { id: 'all_honours', name: 'All honours', chinese: '字一色', faan: 'LIMIT', group: 'limit', notes: 'Only winds and dragons.' },
  { id: 'all_terminals', name: 'All terminals', chinese: '清么九', faan: 'LIMIT', group: 'limit', notes: 'Only 1s and 9s, no honours.' },
  {
    id: 'four_concealed_pungs',
    name: 'Four concealed pungs',
    chinese: '坎坎糊 / 四暗刻',
    faan: 'LIMIT',
    group: 'limit',
    notes: 'Four pungs or kongs, none melded. On a discard win, the set the discard completes counts as melded.',
  },
  { id: 'four_kongs', name: 'Four kongs', chinese: '十八羅漢', faan: 'LIMIT', group: 'limit', notes: 'Four kongs, melded or concealed.' },
  { id: 'nine_gates', name: 'Nine gates', chinese: '九子連環', faan: 'LIMIT', group: 'limit', notes: '1112345678999 of one suit plus any tile of it, fully concealed.' },
  { id: 'heavenly_hand', name: 'Heavenly hand', chinese: '天糊', faan: 'LIMIT', group: 'limit', notes: 'The dealer wins on the initial deal.' },
  { id: 'earthly_hand', name: 'Earthly hand', chinese: '地糊', faan: 'LIMIT', group: 'limit', notes: 'A non-dealer wins on the dealer’s first discard.' },
  { id: 'all_eight_flowers', name: 'All eight flowers', chinese: '八仙過海', faan: 'LIMIT', group: 'limit', notes: 'You draw all eight flowers and seasons.' },
  {
    id: 'seven_robbing_one',
    name: 'Seven flowers robbing the eighth',
    chinese: '七搶一',
    faan: 'LIMIT',
    group: 'limit',
    notes: 'You hold seven flowers and take the eighth when someone else draws it.',
  },
];

/**
 * When both are found, the first replaces the second (it's never scored alongside). Limit hands
 * replace everything; that's handled by the detector, not listed here.
 */
export const HONG_KONG_REPLACES: [string, string][] = [
  ['full_flush', 'mixed_one_suit'],
  ['great_three_dragons', 'small_three_dragons'],
  ['great_four_winds', 'small_four_winds'],
  ['four_concealed_pungs', 'all_pungs'],
];

/** Pairs that can never both be true of one hand. Used to stop impossible picks by hand. */
export const HONG_KONG_NEVER_TOGETHER: [string, string][] = [
  ['all_chows', 'all_pungs'],
  ['all_chows', 'dragon_pung'],
  ['all_chows', 'seat_wind'],
  ['all_chows', 'prevailing_wind'],
  ['all_chows', 'mixed_terminals'],
  ['all_chows', 'small_three_dragons'],
  ['all_chows', 'small_four_winds'],
  ['all_chows', 'great_three_dragons'],
  ['all_chows', 'seven_pairs'],
  ['no_flowers', 'own_flower'],
  ['no_flowers', 'flower_set'],
  ['seven_pairs', 'all_pungs'],
  ['self_drawn', 'robbing_kong'],
];
