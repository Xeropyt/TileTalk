import { BONUS_TILES, HAND_TILES, MIN_HAND_TILES } from '../game/tiles';
import {
  HONG_KONG_REPLACES,
  HONG_KONG_RULE_CHOICES,
  HONG_KONG_SETTINGS,
  HONG_KONG_TABLE,
  HongKongEntry,
  HongKongRuleChoices,
  HongKongSettings,
} from './rulesets/hongKongConfig';
import { decompose } from './tileHand';
import type { WinType } from './types';

/** A set laid down on the table. Only a kong can be concealed (declared from your own tiles). */
export interface HongKongMeld {
  kind: 'chow' | 'pung' | 'kong';
  /** A chow is named by its lowest tile. */
  tile: string;
  concealed?: boolean;
}

export interface HongKongHand {
  /** The tiles still in your hand, including the winning tile. Four of a kind here is a concealed kong. */
  tiles: string[];
  melds?: HongKongMeld[];
  flowers?: string[];
  winType: WinType;
  /** Needed to tell whether a discard completed a pung (it then counts as melded) or the pair. */
  winningTile?: string;
  /** 0 East, 1 South, 2 West, 3 North. */
  seatWind: number;
  prevailingWind: number;
  isDealer?: boolean;
  /**
   * The hand has melded sets that aren't listed in `melds`, as when the tile calculator only
   * knows the tiles. Concealed-only patterns are then never scored.
   */
  openHand?: boolean;
  kongReplacement?: boolean;
  robbingKong?: boolean;
  lastTile?: boolean;
  heavenly?: boolean;
  earthly?: boolean;
}

export interface HongKongConfig {
  settings: HongKongSettings;
  choices: HongKongRuleChoices;
  table: HongKongEntry[];
}

export const HONG_KONG_DEFAULTS: HongKongConfig = {
  settings: HONG_KONG_SETTINGS,
  choices: HONG_KONG_RULE_CHOICES,
  table: HONG_KONG_TABLE,
};

export interface HongKongLine {
  id: string;
  name: string;
  chinese: string;
  count: number;
  /** For this line: faan × count, or limitFaan for a limit hand. */
  faan: number;
}

export interface HongKongScore {
  valid: boolean;
  /** Why it isn't a win, when it isn't. */
  reason: string | null;
  patterns: HongKongLine[];
  faan: number;
  isLimit: boolean;
  /** min(faan, payoutCapFaan). */
  payoutFaan: number;
  /** basePerFaan × 2^(payoutFaan − 1): what one player pays at single rate. */
  payout: number;
}

interface ScoredSet {
  kind: 'chow' | 'pung' | 'kong';
  tile: string;
  /** In hand or a concealed kong. A pung completed by a winning discard isn't. */
  concealed: boolean;
}

const WINDS = ['east', 'south', 'west', 'north'];
const DRAGONS = ['red', 'green', 'white'];
const ORPHANS = ['man1', 'man9', 'pin1', 'pin9', 'sou1', 'sou9', ...WINDS, ...DRAGONS];
// Anchored, so "south" isn't read as bamboo ("sou").
const suitOf = (code: string) => /^(man|pin|sou)[1-9]$/.exec(code)?.[1] ?? null;
const isHonour = (code: string) => suitOf(code) === null;
const isTerminal = (code: string) => /^(man|pin|sou)[19]$/.test(code);
const offset = (code: string, by: number) => `${suitOf(code)}${Number(code.slice(-1)) + by}`;

function setTiles(s: { kind: string; tile: string }): string[] {
  if (s.kind === 'chow') return [s.tile, offset(s.tile, 1), offset(s.tile, 2)];
  return Array(s.kind === 'kong' ? 4 : 3).fill(s.tile);
}

/** BasePerFaan × 2^(faan − 1), using at most payoutCapFaan. */
export function hongKongPayout(faan: number, settings: HongKongSettings = HONG_KONG_SETTINGS): number {
  const used = Math.max(1, Math.min(faan, settings.payoutCapFaan));
  return settings.basePerFaan * 2 ** (used - 1);
}

/**
 * Detects every Hong Kong pattern in a winning hand and adds up its faan. Every way of reading the
 * hand (pungs or chows, seven pairs, which set the winning discard completed) is scored, and the
 * best one is returned.
 */
export function scoreHongKong(hand: HongKongHand, config: HongKongConfig = HONG_KONG_DEFAULTS): HongKongScore {
  const { settings, choices } = config;
  const entry = (id: string) => config.table.find((e) => e.id === id);
  const melds = hand.melds ?? [];
  const flowers = settings.flowers ? (hand.flowers ?? []) : [];
  const allTiles = [...hand.tiles, ...melds.flatMap(setTiles)];
  const fail = (reason: string): HongKongScore => ({ valid: false, reason, patterns: [], faan: 0, isLimit: false, payoutFaan: 0, payout: 0 });

  if (new Set(flowers).size !== flowers.length || flowers.some((f) => !BONUS_TILES.includes(f))) return fail('Each flower and season can only be there once.');
  for (const code of new Set(allTiles)) {
    if (!HAND_TILES.includes(code)) return fail(`Unknown tile: ${code}`);
    if (allTiles.filter((t) => t === code).length > 4) return fail('There are only four of each tile.');
  }
  if (hand.winningTile && !hand.tiles.includes(hand.winningTile)) return fail('The winning tile has to be in the hand.');

  const selfDraw = hand.winType === 'selfDraw';
  const concealedHand = !hand.openHand && melds.every((m) => m.kind === 'kong' && m.concealed);
  const hasKong = melds.some((m) => m.kind === 'kong') || allTiles.length > MIN_HAND_TILES;

  /** Lines that don't depend on how the tiles are read. */
  const common = (): [string, number][] => {
    const seat = hand.seatWind + 1;
    const own = [`flower${seat}`, `season${seat}`].filter((f) => flowers.includes(f));
    const fullSets = ['flower', 'season'].filter((kind) => [1, 2, 3, 4].every((n) => flowers.includes(`${kind}${n}`)));
    // Without stacking, own flowers inside a complete set are already paid for by the set.
    const ownCount = choices.flowerSetStacksWithOwnFlower ? own.length : own.filter((f) => !fullSets.some((k) => f.startsWith(k))).length;
    return [
      ['self_drawn', selfDraw ? 1 : 0],
      ['concealed', concealedHand && (!selfDraw || choices.concealedSelfDrawScoresConcealed) ? 1 : 0],
      ['no_flowers', settings.flowers && flowers.length === 0 ? 1 : 0],
      ['own_flower', ownCount],
      ['flower_set', fullSets.length],
      ['kong_replacement', hand.kongReplacement && selfDraw && hasKong ? 1 : 0],
      ['robbing_kong', hand.robbingKong && !selfDraw ? 1 : 0],
      ['last_tile', hand.lastTile && selfDraw ? 1 : 0],
      ['heavenly_hand', hand.heavenly && hand.isDealer && selfDraw ? 1 : 0],
      ['earthly_hand', hand.earthly && hand.isDealer === false && !selfDraw ? 1 : 0],
    ];
  };

  /** Lines about which tiles the hand holds, for any shape. */
  const tileKinds = (): [string, number][] => {
    const suits = new Set(allTiles.map(suitOf).filter(Boolean));
    const honours = allTiles.some(isHonour);
    return [
      ['full_flush', suits.size === 1 && !honours ? 1 : 0],
      ['mixed_one_suit', suits.size === 1 && honours ? 1 : 0],
      ['all_honours', allTiles.every(isHonour) ? 1 : 0],
      ['all_terminals', allTiles.every(isTerminal) ? 1 : 0],
      ['mixed_terminals', allTiles.every((t) => isTerminal(t) || isHonour(t)) && honours && allTiles.some(isTerminal) ? 1 : 0],
    ];
  };

  const readings: [string, number][][] = [];

  // Eight flowers wins on the spot, whatever the hand holds.
  if (flowers.length === 8) readings.push([[selfDraw ? 'all_eight_flowers' : 'seven_robbing_one', 1]]);

  if (melds.length === 0 && hand.tiles.length === MIN_HAND_TILES && concealedHand) {
    if (ORPHANS.every((t) => hand.tiles.includes(t)) && hand.tiles.every((t) => ORPHANS.includes(t))) {
      readings.push([['thirteen_orphans', 1]]);
    }
    const kinds = [...new Set(hand.tiles)];
    const pairs = kinds.reduce((n, k) => n + Math.floor(hand.tiles.filter((t) => t === k).length / 2), 0);
    const evenCounts = kinds.every((k) => {
      const n = hand.tiles.filter((t) => t === k).length;
      return n === 2 || (n === 4 && choices.sevenPairsAllowsFourOfAKind);
    });
    if (pairs === 7 && evenCounts) {
      const kindLines = tileKinds().filter(([id]) => {
        if (id === 'full_flush' || id === 'mixed_one_suit') return choices.sevenPairsWithFlush;
        if (id === 'all_honours') return choices.allHonoursSevenPairsIsLimit;
        return true;
      });
      readings.push([['seven_pairs', 1], ...kindLines, ...common()]);
    }
    const suit = suitOf(hand.tiles[0]);
    const n = (k: number) => hand.tiles.filter((t) => t === `${suit}${k}`).length;
    if (suit && hand.tiles.every((t) => suitOf(t) === suit) && n(1) >= 3 && n(9) >= 3 && [2, 3, 4, 5, 6, 7, 8].every((k) => n(k) >= 1)) {
      readings.push([['nine_gates', 1]]);
    }
  }

  for (const d of decompose(hand.tiles, 4 - melds.length)) {
    const base: ScoredSet[] = [
      ...melds.map((m) => ({ kind: m.kind, tile: m.tile, concealed: m.kind === 'kong' && !!m.concealed })),
      ...d.sets.map((s) => ({ ...s, concealed: true })),
    ];
    // A winning discard completes one group, which then counts as melded. Try each it could be.
    const variants: ScoredSet[][] = [];
    if (selfDraw) variants.push(base);
    else {
      // A discard can't complete a kong, so only pungs and chows in hand are candidates.
      const inHand = base.map((s, i) => ({ s, i })).filter(({ s, i }) => i >= melds.length && s.kind !== 'kong');
      const expose = (i: number) => base.map((s, j) => (j === i ? { ...s, concealed: false } : s));
      if (hand.winningTile) {
        if (d.pair === hand.winningTile) variants.push(base);
        for (const { s, i } of inHand) if (setTiles(s).includes(hand.winningTile)) variants.push(expose(i));
      } else {
        // Unknown winning tile: assume the worst, that it completed a pung.
        const pung = inHand.find(({ s }) => s.kind === 'pung');
        variants.push(pung ? expose(pung.i) : base);
      }
      if (variants.length === 0) variants.push(base);
    }

    for (const sets of variants) {
      const pungs = sets.filter((s) => s.kind !== 'chow');
      const dragons = pungs.filter((s) => DRAGONS.includes(s.tile)).length;
      const winds = pungs.filter((s) => WINDS.includes(s.tile)).length;
      const great3 = dragons === 3;
      const small3 = dragons === 2 && DRAGONS.includes(d.pair);
      const small4 = winds === 3 && WINDS.includes(d.pair);
      const windPungsCount = !small4 || choices.windPungsStackWithSmallFourWinds;
      readings.push([
        ['all_chows', sets.every((s) => s.kind === 'chow') ? 1 : 0],
        ['all_pungs', pungs.length === 4 ? 1 : 0],
        ['great_three_dragons', great3 ? 1 : 0],
        ['small_three_dragons', small3 ? 1 : 0],
        ['dragon_pung', (great3 || small3) && !choices.dragonPungsStackWithThreeDragons ? 0 : dragons],
        ['great_four_winds', winds === 4 ? 1 : 0],
        ['small_four_winds', small4 ? 1 : 0],
        ['seat_wind', windPungsCount && pungs.some((s) => s.tile === WINDS[hand.seatWind]) ? 1 : 0],
        ['prevailing_wind', windPungsCount && pungs.some((s) => s.tile === WINDS[hand.prevailingWind]) ? 1 : 0],
        ['four_kongs', sets.every((s) => s.kind === 'kong') ? 1 : 0],
        ['four_concealed_pungs', pungs.length === 4 && pungs.every((s) => s.concealed) ? 1 : 0],
        ...tileKinds(),
        ...common(),
      ]);
    }
  }

  if (readings.length === 0) {
    return fail(melds.length ? 'The tiles in hand don’t complete the melded sets into a winning hand.' : 'These tiles don’t make a winning hand.');
  }

  let best: HongKongScore | null = null;
  for (const reading of readings) {
    const score = resolve(reading, entry, settings);
    if (!best || score.faan > best.faan || (score.faan === best.faan && score.isLimit && !best.isLimit)) best = score;
  }
  return best!;
}

/** Applies the stacking rules to one reading's lines and adds up the faan. */
function resolve(
  reading: [string, number][],
  entry: (id: string) => HongKongEntry | undefined,
  settings: HongKongSettings,
): HongKongScore {
  let found = reading.filter(([id, count]) => count > 0 && entry(id)).map(([id, count]) => ({ e: entry(id)!, count }));
  const limits = found.filter((f) => f.e.faan === 'LIMIT');
  if (limits.length) {
    // Any limit hand scores exactly limitFaan; nothing else counts.
    found = limits;
  } else {
    for (const [winner, loser] of HONG_KONG_REPLACES) {
      if (found.some((f) => f.e.id === winner)) found = found.filter((f) => f.e.id !== loser);
    }
  }
  const isLimit = limits.length > 0;
  const patterns = found.map(({ e, count }) => {
    const c = Math.min(count, e.maxCount ?? 1);
    return { id: e.id, name: e.name, chinese: e.chinese, count: c, faan: e.faan === 'LIMIT' ? settings.limitFaan : e.faan * c };
  });
  const faan = isLimit ? settings.limitFaan : patterns.reduce((sum, p) => sum + p.faan, 0);
  const valid = faan >= settings.minFaanToWin;
  const payoutFaan = Math.min(faan, settings.payoutCapFaan);
  return {
    valid,
    reason: valid ? null : `${faan} faan is below the ${settings.minFaanToWin} needed to win.`,
    patterns,
    faan,
    isLimit,
    payoutFaan,
    payout: valid ? hongKongPayout(faan, settings) : 0,
  };
}
