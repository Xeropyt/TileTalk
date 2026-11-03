import { initialTable, TableState } from '../../game/winds';
import {
  chomboPayments,
  limitName,
  nearestToDiscarder,
  nextRiichiTable,
  RIICHI_DEFAULTS,
  riichiBase,
  riichiFinalResults,
  riichiWinPayments,
  settleRiichiHand,
  tenpaiPayments,
} from '../riichi';

const opts = RIICHI_DEFAULTS[4];
const four = ['e', 's', 'w', 'n']; // seat order; 'e' deals
const win = (han: number, fu: number, winnerId: string, discarderId: string | null, dealerId = 'e', honba = 0, players = four, o = opts) =>
  riichiWinPayments({ playerIds: players, dealerId, winnerId, discarderId, base: riichiBase(han, fu, o), honba, opts: o });

// The spec's test values: [han, fu, non-dealer ron, non-dealer tsumo (from non-dealer / from dealer), dealer ron, dealer tsumo each].
const TABLE: [number, number, number | null, [number, number], number | null, number][] = [
  [1, 30, 1000, [300, 500], 1500, 500],
  [2, 30, 2000, [500, 1000], 2900, 1000],
  [3, 30, 3900, [1000, 2000], 5800, 2000],
  [4, 30, 7700, [2000, 3900], 11600, 3900],
  [3, 40, 5200, [1300, 2600], 7700, 2600],
  [2, 20, null, [400, 700], null, 700],
  [2, 25, 1600, [400, 800], 2400, 800],
  [4, 25, 6400, [1600, 3200], 9600, 3200],
  [5, 30, 8000, [2000, 4000], 12000, 4000],
];

describe('riichi points', () => {
  test.each(TABLE.map((r) => [`${r[0]} han ${r[1]} fu`, ...r] as const))('%s', (_, han, fu, ndRon, ndTsumo, dRon, dTsumo) => {
    if (ndRon !== null) expect(win(han, fu, 's', 'w').w).toBe(-ndRon);
    const t = win(han, fu, 's', null);
    expect([t.w, t.e]).toEqual([-ndTsumo[0], -ndTsumo[1]]);
    if (dRon !== null) expect(win(han, fu, 'e', 'w').w).toBe(-dRon);
    expect(win(han, fu, 'e', null).s).toBe(-dTsumo);
  });

  test('limits', () => {
    expect([5, 6, 8, 11, 13].map((h) => limitName(riichiBase(h, 30, opts)))).toEqual(['Mangan', 'Haneman', 'Baiman', 'Sanbaiman', 'Yakuman']);
    expect(riichiBase(13, 30, { ...opts, kazoeYakuman: false })).toBe(6000);
    expect(riichiBase(0, 0, opts, 2)).toBe(16000);
    expect(riichiBase(4, 30, { ...opts, kiriageMangan: true })).toBe(2000);
  });

  test('honba: the discarder pays 300 each on a ron, everyone 100 each on a tsumo', () => {
    expect(win(2, 30, 's', 'w', 'e', 2).s).toBe(2600);
    const t = win(1, 30, 's', null, 'e', 1);
    expect(t).toEqual({ e: -600, s: 1400, w: -400, n: -400 });
  });

  test('payments always sum to zero', () => {
    for (const d of [win(3, 40, 'n', 'e', 'e', 3), win(6, 30, 'e', null, 'e', 1)]) {
      expect(Object.values(d).reduce((a, b) => a + b, 0)).toBe(0);
    }
  });
});

describe('double ron', () => {
  test('honba and sticks go to the winner next after the discarder', () => {
    expect(nearestToDiscarder(four, 'w', ['e', 's'])).toBe('e');
    expect(nearestToDiscarder(four, 's', ['e', 'n'])).toBe('n');
  });
});

describe('draws and chombo', () => {
  test('exhaustive draw tenpai payments', () => {
    expect(tenpaiPayments(four, [], 3000)).toEqual({ e: 0, s: 0, w: 0, n: 0 });
    expect(tenpaiPayments(four, ['e'], 3000)).toEqual({ e: 3000, s: -1000, w: -1000, n: -1000 });
    expect(tenpaiPayments(four, ['e', 's'], 3000)).toEqual({ e: 1500, s: 1500, w: -1500, n: -1500 });
    expect(tenpaiPayments(four, ['e', 's', 'w'], 3000)).toEqual({ e: 1000, s: 1000, w: 1000, n: -3000 });
    expect(tenpaiPayments(four, four, 3000)).toEqual({ e: 0, s: 0, w: 0, n: 0 });
  });

  test('chombo is a reverse mangan', () => {
    expect(chomboPayments(four, 'e', 's')).toEqual({ e: 4000, s: -8000, w: 2000, n: 2000 });
    expect(chomboPayments(four, 'e', 'e')).toEqual({ e: -12000, s: 4000, w: 4000, n: 4000 });
  });
});

describe('dealer rotation', () => {
  const start = { ...initialTable(), honba: 0, riichiSticks: 0 };

  test('the dealer keeps the deal on a win or tenpai, and honba count up', () => {
    const kept = nextRiichiTable(start, { kind: 'win', dealerWon: true }, opts, 4, 0);
    expect([kept.dealerIndex, kept.honba]).toEqual([0, 1]);
    const tenpai = nextRiichiTable(kept, { kind: 'exhaustive', dealerTenpai: true }, opts, 4, 1);
    expect([tenpai.dealerIndex, tenpai.honba, tenpai.riichiSticks]).toEqual([0, 2, 1]);
    const noten = nextRiichiTable(tenpai, { kind: 'exhaustive', dealerTenpai: false }, opts, 4, 1);
    expect([noten.dealerIndex, noten.honba]).toEqual([1, 3]);
    const lost = nextRiichiTable(noten, { kind: 'win', dealerWon: false }, opts, 4, 0);
    expect([lost.dealerIndex, lost.honba]).toEqual([2, 0]);
  });

  test('chombo replays the hand with nothing changed', () => {
    const s = { ...start, honba: 2, riichiSticks: 1 };
    expect(nextRiichiTable(s, { kind: 'chombo' }, opts, 4, 1)).toEqual({ ...s, handNumber: 2 });
  });

  test('a hanchan ends after South 4; a tonpuusen after East 4', () => {
    const passes = (o: typeof opts, players: number) => {
      let s: TableState = start;
      let n = 0;
      while (!s.finished) {
        s = nextRiichiTable(s, { kind: 'win', dealerWon: false }, o, players, 0);
        n++;
      }
      return n;
    };
    expect(passes(opts, 4)).toBe(8);
    expect(passes({ ...opts, gameLength: 'tonpuusen' }, 4)).toBe(4);
    expect(passes(RIICHI_DEFAULTS[3], 3)).toBe(6);
  });
});

describe('final results', () => {
  test('the spec example: oka and uma add up to zero', () => {
    const results = riichiFinalResults(four, { e: 42300, s: 28000, w: 19700, n: 10000 }, 0, opts);
    expect(results.map((r) => r.result)).toEqual([47.3, 3, -15.3, -35]);
  });

  test('ties go to the seat nearer the first dealer, and leftover sticks to first', () => {
    const results = riichiFinalResults(four, { e: 24000, s: 30000, w: 30000, n: 15000 }, 1, opts);
    expect(results.map((r) => r.playerId)).toEqual(['s', 'w', 'e', 'n']);
    expect(results[0].points).toBe(31000);
  });
});

describe('three players', () => {
  const three = ['e', 's', 'w'];
  const sanma = RIICHI_DEFAULTS[3];

  test('tsumo loss: the missing North share isn’t paid', () => {
    expect(win(3, 30, 's', 'w', 'e', 0, three, sanma).s).toBe(3900);
    expect(win(3, 30, 's', null, 'e', 0, three, sanma)).toEqual({ e: -2000, s: 3000, w: -1000 });
  });

  test('no tsumo loss: the two payers split the full value', () => {
    expect(win(3, 30, 's', null, 'e', 0, three, { ...sanma, tsumoLoss: false })).toEqual({ e: -2000, s: 4000, w: -2000 });
  });

  test('2,000 tenpai payments', () => {
    expect(tenpaiPayments(three, ['e'], sanma.tenpaiPayment)).toEqual({ e: 2000, s: -1000, w: -1000 });
  });
});

describe('settleRiichiHand', () => {
  const ctx = { playerIds: four, dealerId: 'e', honba: 1, sticks: 1, opts };

  test('a riichi win takes the sticks on the table and its own', () => {
    const s = settleRiichiHand(
      { kind: 'win', discarderId: 'w', winners: [{ playerId: 's', han: 1, fu: 30, yakuman: 0 }], declarers: ['s'] },
      ctx,
    );
    // 1,000 ron + 300 honba from West; South puts in 1,000 and takes both sticks.
    expect(s.payments).toEqual({ e: 0, s: 2300, w: -1300, n: 0 });
    expect(s.sticksAfter).toBe(0);
  });

  test('double ron: both are paid in full, honba and sticks go to the nearest winner', () => {
    const s = settleRiichiHand(
      {
        kind: 'win',
        discarderId: 'w',
        winners: [
          { playerId: 's', han: 2, fu: 30, yakuman: 0 },
          { playerId: 'n', han: 1, fu: 30, yakuman: 0 },
        ],
        declarers: [],
      },
      ctx,
    );
    expect(s.mainWinnerId).toBe('n');
    expect(s.payments).toEqual({ e: 0, s: 2000, w: -3300, n: 2300 });
  });

  test('exhaustive draw: riichi sticks stay on the table', () => {
    const s = settleRiichiHand({ kind: 'exhaustive', tenpai: ['s'], declarers: ['s'], nagashiId: null }, ctx);
    expect(s.payments).toEqual({ e: -1000, s: 2000, w: -1000, n: -1000 });
    expect(s.sticksAfter).toBe(2);
    expect(s.outcome).toEqual({ kind: 'exhaustive', dealerTenpai: false });
  });

  test('nagashi mangan is paid as a mangan tsumo instead of tenpai payments', () => {
    const s = settleRiichiHand({ kind: 'exhaustive', tenpai: ['e'], declarers: [], nagashiId: 'w' }, ctx);
    expect(s.payments).toEqual({ e: -4000, s: -2000, w: 8000, n: -2000 });
  });

  test('chombo leaves the sticks alone', () => {
    const s = settleRiichiHand({ kind: 'chombo', offenderId: 'n' }, ctx);
    expect(s.sticksAfter).toBe(1);
    expect(s.payments.n).toBe(-8000);
  });
});
