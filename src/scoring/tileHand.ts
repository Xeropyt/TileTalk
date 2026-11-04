import { BONUS_TILES, HAND_TILES, MAX_HAND_TILES, MIN_HAND_TILES } from '../game/tiles';
import { findPattern, scoreHand } from './engine';
import type { ClaimedPattern, Ruleset } from './types';

/** A chow is named by its lowest tile. */
export interface TileSet {
  kind: 'chow' | 'pung' | 'kong';
  tile: string;
}

export interface Decomposition {
  sets: TileSet[];
  pair: string;
}

/** The winner's seat and the round, which decide the wind pungs and own flowers. */
export interface TileContext {
  /** 0 East, 1 South, 2 West, 3 North. Own flowers are this + 1. */
  seatWind: number;
  prevailingWind: number;
}

export type TileReading =
  | { ok: true; patterns: ClaimedPattern[]; decomposition: Decomposition | null }
  | { ok: false; reason: string };

const WINDS = ['east', 'south', 'west', 'north'];
const DRAGONS = ['red', 'green', 'white'];
const GREEN = ['sou2', 'sou3', 'sou4', 'sou6', 'sou8', 'green'];
const ORPHANS = ['man1', 'man9', 'pin1', 'pin9', 'sou1', 'sou9', ...WINDS, ...DRAGONS];

// Anchored, so "south" isn't read as bamboo ("sou").
const suitOf = (code: string) => /^(man|pin|sou)[1-9]$/.exec(code)?.[1] ?? null;
const isHonour = (code: string) => suitOf(code) === null;
const isTerminal = (code: string) => /^(man|pin|sou)[19]$/.test(code);

/**
 * Every way to split a winning hand into four sets and a pair (or fewer sets, for the concealed
 * part of a hand with melded sets). Each tile beyond 3 per set plus the pair is a kong.
 * Thirteen orphans isn't sets and a pair, so isn't included.
 */
export function decompose(tiles: string[], setsNeeded = 4): Decomposition[] {
  const kongs = tiles.length - (setsNeeded * 3 + 2);
  if (kongs < 0 || kongs > setsNeeded) return [];
  const counts = HAND_TILES.map((code) => tiles.filter((t) => t === code).length);
  if (counts.reduce((a, b) => a + b, 0) !== tiles.length) return [];

  const out: Decomposition[] = [];
  const sets: TileSet[] = [];
  const search = (pair: number | null, kongsLeft: number) => {
    const i = counts.findIndex((c) => c > 0);
    if (i === -1) {
      if (pair !== null && sets.length === setsNeeded && kongsLeft === 0) out.push({ sets: [...sets], pair: HAND_TILES[pair] });
      return;
    }
    if (sets.length > setsNeeded) return;
    const take = (n: number[], set: TileSet | null, nextPair: number | null, nextKongs: number) => {
      n.forEach((j) => counts[j]--);
      if (set) sets.push(set);
      search(nextPair, nextKongs);
      if (set) sets.pop();
      n.forEach((j) => counts[j]++);
    };
    if (pair === null && counts[i] >= 2) take([i, i], null, i, kongsLeft);
    if (counts[i] >= 3) take([i, i, i], { kind: 'pung', tile: HAND_TILES[i] }, pair, kongsLeft);
    if (kongsLeft > 0 && counts[i] >= 4) take([i, i, i, i], { kind: 'kong', tile: HAND_TILES[i] }, pair, kongsLeft - 1);
    // Chows run within one suit: 1-2-3 up to 7-8-9.
    if (i < 27 && i % 9 <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0) {
      take([i, i + 1, i + 2], { kind: 'chow', tile: HAND_TILES[i] }, pair, kongsLeft);
    }
  };
  search(null, kongs);
  return out;
}

function isThirteenOrphans(tiles: string[]): boolean {
  return tiles.length === 14 && tiles.every((t) => ORPHANS.includes(t)) && ORPHANS.every((t) => tiles.includes(t));
}

/** 1112345678999 of one suit plus one more of that suit. */
function isNineGates(tiles: string[]): boolean {
  const suit = suitOf(tiles[0] ?? '');
  if (!suit || tiles.length !== 14 || !tiles.every((t) => suitOf(t) === suit)) return false;
  const n = (k: number) => tiles.filter((t) => t === `${suit}${k}`).length;
  return n(1) >= 3 && n(9) >= 3 && [2, 3, 4, 5, 6, 7, 8].every((k) => n(k) >= 1);
}

function flowerPatterns(flowers: string[], ctx: TileContext): ClaimedPattern[] {
  const seat = ctx.seatWind + 1;
  const own = [`flower${seat}`, `season${seat}`].filter((f) => flowers.includes(f)).length;
  const sets = ['flower', 'season'].filter((kind) => [1, 2, 3, 4].every((k) => flowers.includes(`${kind}${k}`))).length;
  return [
    { id: 'seat_flower', count: own },
    { id: 'flower_set', count: sets },
  ];
}

/** The patterns one way of reading the hand makes. Limit hands replace everything but flowers. */
function handPatterns(tiles: string[], d: Decomposition, ctx: TileContext): ClaimedPattern[] {
  const pungs = d.sets.filter((s) => s.kind !== 'chow');
  const dragonPungs = pungs.filter((s) => DRAGONS.includes(s.tile)).length;
  const windPungs = pungs.filter((s) => WINDS.includes(s.tile)).length;
  const suits = new Set(tiles.map(suitOf).filter(Boolean));
  const honours = tiles.some(isHonour);

  const limits: ClaimedPattern[] = [];
  const limit = (id: string, when: boolean) => when && limits.push({ id, count: 1 });
  limit('all_kongs', d.sets.every((s) => s.kind === 'kong'));
  limit('big_three_dragons', dragonPungs === 3);
  limit('big_four_winds', windPungs === 4);
  limit('small_four_winds', windPungs === 3 && WINDS.includes(d.pair));
  limit('all_honours', tiles.every(isHonour));
  limit('all_green', tiles.every((t) => GREEN.includes(t)));
  limit('terminals_only', tiles.every(isTerminal));
  limit('mixed_terminals', tiles.every((t) => isTerminal(t) || isHonour(t)) && honours && tiles.some(isTerminal));
  limit('nine_gates', isNineGates(tiles));
  if (limits.length) return limits;

  return [
    { id: 'all_chows', count: d.sets.every((s) => s.kind === 'chow') ? 1 : 0 },
    { id: 'all_pungs', count: pungs.length === 4 ? 1 : 0 },
    { id: 'full_flush', count: suits.size === 1 && !honours ? 1 : 0 },
    { id: 'half_flush', count: suits.size === 1 && honours ? 1 : 0 },
    { id: 'small_three_dragons', count: dragonPungs === 2 && DRAGONS.includes(d.pair) ? 1 : 0 },
    { id: 'dragon_pung', count: dragonPungs },
    { id: 'seat_wind_pung', count: pungs.some((s) => s.tile === WINDS[ctx.seatWind]) ? 1 : 0 },
    { id: 'prevailing_wind_pung', count: pungs.some((s) => s.tile === WINDS[ctx.prevailingWind]) ? 1 : 0 },
  ];
}

/**
 * Works out every pattern the tiles alone show: the hand's shape, its sets, limit hands and
 * flowers. Things the tiles can't show, like a concealed hand or winning on the last tile, are
 * left for the player to add. When the tiles can be read more than one way (111222333 is three
 * pungs or three chows), the reading worth the most tai wins.
 */
export function readTiles(ruleset: Ruleset, tiles: string[], flowers: string[], ctx: TileContext): TileReading {
  const known = (list: ClaimedPattern[]) => list.filter((c) => c.count > 0 && findPattern(ruleset, c.id));
  const bonus = flowerPatterns(flowers, ctx);
  if (flowers.length > BONUS_TILES.length) return { ok: false, reason: 'There are only 8 flowers and seasons.' };

  // Seven or eight flowers wins on the spot, whatever the hand holds.
  if (flowers.length >= 7) return { ok: true, patterns: known([{ id: 'flower_win', count: 1 }, ...bonus]), decomposition: null };

  if (tiles.length < MIN_HAND_TILES) {
    const missing = MIN_HAND_TILES - tiles.length;
    return { ok: false, reason: `Add ${missing} more ${missing === 1 ? 'tile' : 'tiles'}.` };
  }
  if (tiles.length > MAX_HAND_TILES) return { ok: false, reason: `A hand has at most ${MAX_HAND_TILES} tiles, with four kongs.` };
  if (isThirteenOrphans(tiles)) return { ok: true, patterns: known([{ id: 'thirteen_orphans', count: 1 }, ...bonus]), decomposition: null };

  const readings = decompose(tiles);
  if (readings.length === 0) {
    return {
      ok: false,
      reason:
        tiles.length > MIN_HAND_TILES
          ? `These tiles don’t make four sets and a pair with ${tiles.length - MIN_HAND_TILES} ${tiles.length === 15 ? 'kong' : 'kongs'}.`
          : 'These tiles don’t make four sets and a pair.',
    };
  }
  let best: { patterns: ClaimedPattern[]; decomposition: Decomposition; tai: number } | null = null;
  for (const d of readings) {
    const patterns = known([...handPatterns(tiles, d, ctx), ...bonus]);
    const score = scoreHand(ruleset, patterns);
    const tai = score.isLimit ? Infinity : score.rawTai;
    if (!best || tai > best.tai) best = { patterns, decomposition: d, tai };
  }
  return { ok: true, patterns: best!.patterns, decomposition: best!.decomposition };
}
