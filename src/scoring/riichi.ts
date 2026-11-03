// Riichi (Japanese) scoring: han and fu, honba, riichi sticks, draws, chombo and oka/uma.
// Follows the TileTalk Riichi & 3-Player Rules Spec. Everything here is pure, so it's unit tested directly.
import type { TableState } from '../game/winds';
import type { RiichiOptions } from './types';

export const RIICHI_DEFAULTS: { 4: RiichiOptions; 3: RiichiOptions } = {
  4: {
    gameLength: 'hanchan',
    startingPoints: 25000,
    returnPoints: 30000,
    uma: [15, 5, -5, -15],
    multipleRon: 'double',
    busting: true,
    kiriageMangan: false,
    kazoeYakuman: true,
    nagashiMangan: true,
    tenpaiPayment: 3000,
    honbaValue: 300,
    tsumoLoss: true,
    leftoverSticks: 'first',
  },
  // Sanma: the common online defaults.
  3: {
    gameLength: 'hanchan',
    startingPoints: 35000,
    returnPoints: 40000,
    uma: [20, 0, -20],
    multipleRon: 'double',
    busting: true,
    kiriageMangan: false,
    kazoeYakuman: true,
    nagashiMangan: true,
    tenpaiPayment: 2000,
    honbaValue: 300,
    tsumoLoss: true,
    leftoverSticks: 'first',
  },
};

export const RIICHI_STICK = 1000;
/** The fu values a hand can have. */
export const FU_CHOICES = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];
/** Han at which fu stop mattering. */
export const MANGAN_HAN = 5;

const roundUp100 = (n: number) => Math.ceil(n / 100) * 100;

/** The base value every payment comes from. `yakuman` is how many yakuman the hand has. */
export function riichiBase(han: number, fu: number, opts: Pick<RiichiOptions, 'kiriageMangan' | 'kazoeYakuman'>, yakuman = 0): number {
  if (yakuman > 0) return 8000 * yakuman;
  if (han >= 13) return opts.kazoeYakuman ? 8000 : 6000;
  if (han >= 11) return 6000;
  if (han >= 8) return 4000;
  if (han >= 6) return 3000;
  if (han >= 5) return 2000;
  if (opts.kiriageMangan && ((han === 4 && fu === 30) || (han === 3 && fu === 60))) return 2000;
  return Math.min(2000, fu * 2 ** (2 + han));
}

/** The name of a limit hand, or null below mangan. */
export function limitName(base: number): string | null {
  if (base >= 16000) return `${base / 8000}× yakuman`;
  if (base >= 8000) return 'Yakuman';
  if (base >= 6000) return 'Sanbaiman';
  if (base >= 4000) return 'Baiman';
  if (base >= 3000) return 'Haneman';
  if (base >= 2000) return 'Mangan';
  return null;
}

/** For stats and the Hub: han, or 13 per yakuman, so bigger hands sort higher. */
export function handValue(han: number, yakuman: number): number {
  return yakuman > 0 ? 13 * yakuman : han;
}

type Deltas = Record<string, number>;
const zero = (ids: string[]): Deltas => Object.fromEntries(ids.map((id) => [id, 0]));
function pay(d: Deltas, from: string, to: string, amount: number) {
  d[from] -= amount;
  d[to] += amount;
}

/**
 * Points for one win, honba included but not riichi sticks (those come off the table).
 * `discarderId` null means tsumo. Players are in seat order.
 */
export function riichiWinPayments(args: {
  playerIds: string[];
  dealerId: string;
  winnerId: string;
  discarderId: string | null;
  base: number;
  honba: number;
  opts: Pick<RiichiOptions, 'honbaValue' | 'tsumoLoss'>;
}): Deltas {
  const { playerIds, dealerId, winnerId, discarderId, base, honba, opts } = args;
  const d = zero(playerIds);
  const winnerIsDealer = winnerId === dealerId;

  if (discarderId) {
    pay(d, discarderId, winnerId, roundUp100(base * (winnerIsDealer ? 6 : 4)) + honba * opts.honbaValue);
    return d;
  }

  const payers = playerIds.filter((id) => id !== winnerId);
  // With three players and no tsumo loss, the two payers split the full four-player value.
  const split = playerIds.length === 3 && !opts.tsumoLoss;
  const honbaEach = honba * (split ? opts.honbaValue / 2 : opts.honbaValue / 3);
  for (const id of payers) {
    const share = split
      ? base * (winnerIsDealer ? 3 : 2)
      : base * (winnerIsDealer || id === dealerId ? 2 : 1);
    pay(d, id, winnerId, roundUp100(share) + honbaEach);
  }
  return d;
}

/** Of several players who ron the same tile, the one next after the discarder in turn order. */
export function nearestToDiscarder(playerIds: string[], discarderId: string, winnerIds: string[]): string {
  const n = playerIds.length;
  const from = playerIds.indexOf(discarderId);
  const distance = (id: string) => (playerIds.indexOf(id) - from + n) % n;
  return [...winnerIds].sort((a, b) => distance(a) - distance(b))[0];
}

/** Noten players pay tenpai players `total` between them at an exhaustive draw. */
export function tenpaiPayments(playerIds: string[], tenpaiIds: string[], total: number): Deltas {
  const d = zero(playerIds);
  const noten = playerIds.filter((id) => !tenpaiIds.includes(id));
  if (tenpaiIds.length === 0 || noten.length === 0) return d;
  for (const id of noten) d[id] -= total / noten.length;
  for (const id of tenpaiIds) d[id] += total / tenpaiIds.length;
  return d;
}

/** A chombo: the offender pays a reverse mangan. */
export function chomboPayments(playerIds: string[], dealerId: string, offenderId: string): Deltas {
  const d = zero(playerIds);
  for (const id of playerIds) {
    if (id === offenderId) continue;
    pay(d, offenderId, id, offenderId === dealerId || id === dealerId ? 4000 : 2000);
  }
  return d;
}

export function addDeltas(...all: Deltas[]): Deltas {
  const out: Deltas = {};
  for (const d of all) for (const [id, v] of Object.entries(d)) out[id] = (out[id] ?? 0) + v;
  return out;
}

export type RiichiOutcome =
  | { kind: 'win'; dealerWon: boolean }
  | { kind: 'exhaustive'; dealerTenpai: boolean }
  | { kind: 'abortive' }
  | { kind: 'chombo' };

/**
 * The table for the next hand. The dealer keeps the deal on a win or when tenpai at a draw.
 * Honba: +1 when the dealer keeps it or the hand is drawn, reset when a non-dealer wins.
 * `sticks` is what's on the table after this hand.
 */
export function nextRiichiTable(
  state: TableState,
  outcome: RiichiOutcome,
  opts: Pick<RiichiOptions, 'gameLength'>,
  playerCount: number,
  sticks: number,
): TableState {
  const honba = state.honba ?? 0;
  const base = { ...state, handNumber: state.handNumber + 1, riichiSticks: sticks };
  if (outcome.kind === 'chombo') return base;

  const stays =
    outcome.kind === 'abortive' ||
    (outcome.kind === 'win' && outcome.dealerWon) ||
    (outcome.kind === 'exhaustive' && outcome.dealerTenpai);
  const nextHonba = outcome.kind === 'win' && !outcome.dealerWon ? 0 : honba + 1;
  if (stays) return { ...base, honba: nextHonba, dealerStreak: state.dealerStreak + 1 };

  const dealerIndex = (state.dealerIndex + 1) % playerCount;
  let { prevailingWind } = state;
  let finished = false;
  if (dealerIndex === 0) {
    const lastRound = opts.gameLength === 'tonpuusen' ? 0 : 1;
    if (prevailingWind >= lastRound) finished = true;
    else prevailingWind = (prevailingWind + 1) as TableState['prevailingWind'];
  }
  return { ...base, dealerIndex, prevailingWind, honba: nextHonba, dealerStreak: 0, finished };
}

export interface RiichiResult {
  playerId: string;
  /** Points at the end, with any leftover sticks if they went to first place. */
  points: number;
  rank: number;
  /** In thousands, after return points, oka and uma. All results add up to zero. */
  result: number;
}

/**
 * Final standings. Ties go to whoever sat closer to the first dealer. First place gets the oka
 * (what everyone gave up between the starting and return points) and, by default, leftover sticks.
 */
export function riichiFinalResults(
  playerIds: string[],
  scores: Record<string, number>,
  sticks: number,
  opts: Pick<RiichiOptions, 'startingPoints' | 'returnPoints' | 'uma' | 'leftoverSticks'>,
): RiichiResult[] {
  const order = [...playerIds].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0) || playerIds.indexOf(a) - playerIds.indexOf(b));
  const oka = ((opts.returnPoints - opts.startingPoints) * playerIds.length) / 1000;
  return order.map((playerId, i) => {
    const points = (scores[playerId] ?? 0) + (i === 0 && opts.leftoverSticks === 'first' ? sticks * RIICHI_STICK : 0);
    const raw = (points - opts.returnPoints) / 1000 + (opts.uma[i] ?? 0) + (i === 0 ? oka : 0);
    return { playerId, points, rank: i + 1, result: Math.round(raw * 10) / 10 };
  });
}

export interface RiichiWinner {
  playerId: string;
  han: number;
  fu: number;
  /** 0 for a regular hand, 1 for a yakuman, 2 for a double yakuman. */
  yakuman: number;
}

/** What was entered for one hand. */
export type RiichiHandEntry =
  | { kind: 'win'; discarderId: string | null; winners: RiichiWinner[]; declarers: string[] }
  | { kind: 'exhaustive'; tenpai: string[]; declarers: string[]; nagashiId: string | null }
  | { kind: 'abortive'; declarers: string[] }
  | { kind: 'chombo'; offenderId: string };

export interface RiichiSettlement {
  payments: Deltas;
  outcome: RiichiOutcome;
  /** Riichi sticks on the table after the hand. */
  sticksAfter: number;
  /** The winner who took the honba and sticks (the only winner, unless it was a double ron). */
  mainWinnerId: string | null;
  /** Base value for each winner, in the same order. */
  bases: number[];
}

/**
 * Works out everything a hand pays. Riichi declarers put 1,000 on the table; a win collects
 * every stick there. On a double ron, honba and sticks go to the winner nearest the discarder.
 */
export function settleRiichiHand(
  entry: RiichiHandEntry,
  ctx: { playerIds: string[]; dealerId: string; honba: number; sticks: number; opts: RiichiOptions },
): RiichiSettlement {
  const { playerIds, dealerId, honba, sticks, opts } = ctx;
  const declared = (ids: string[]) => Object.fromEntries(playerIds.map((id) => [id, ids.includes(id) ? -RIICHI_STICK : 0]));

  if (entry.kind === 'chombo') {
    // Sticks declared this hand go back to their owners, which is the same as never placing them.
    return {
      payments: chomboPayments(playerIds, dealerId, entry.offenderId),
      outcome: { kind: 'chombo' },
      sticksAfter: sticks,
      mainWinnerId: null,
      bases: [],
    };
  }

  const sticksNow = sticks + entry.declarers.length;
  if (entry.kind === 'abortive') {
    return { payments: declared(entry.declarers), outcome: { kind: 'abortive' }, sticksAfter: sticksNow, mainWinnerId: null, bases: [] };
  }

  if (entry.kind === 'exhaustive') {
    const nagashi = opts.nagashiMangan && entry.nagashiId;
    const draw = nagashi
      ? riichiWinPayments({ playerIds, dealerId, winnerId: entry.nagashiId!, discarderId: null, base: 2000, honba: 0, opts })
      : tenpaiPayments(playerIds, entry.tenpai, opts.tenpaiPayment);
    return {
      payments: addDeltas(declared(entry.declarers), draw),
      outcome: { kind: 'exhaustive', dealerTenpai: entry.tenpai.includes(dealerId) },
      sticksAfter: sticksNow,
      mainWinnerId: null,
      bases: [],
    };
  }

  const main = entry.discarderId
    ? nearestToDiscarder(playerIds, entry.discarderId, entry.winners.map((w) => w.playerId))
    : entry.winners[0].playerId;
  const bases = entry.winners.map((w) => riichiBase(w.han, w.fu, opts, w.yakuman));
  const wins = entry.winners.map((w, i) =>
    riichiWinPayments({
      playerIds,
      dealerId,
      winnerId: w.playerId,
      discarderId: entry.discarderId,
      base: bases[i],
      honba: w.playerId === main ? honba : 0,
      opts,
    }),
  );
  const pot = Object.fromEntries(playerIds.map((id) => [id, id === main ? sticksNow * RIICHI_STICK : 0]));
  return {
    payments: addDeltas(declared(entry.declarers), ...wins, pot),
    outcome: { kind: 'win', dealerWon: entry.winners.some((w) => w.playerId === dealerId) },
    sticksAfter: 0,
    mainWinnerId: main,
    bases,
  };
}
