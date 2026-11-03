import {
  blockedBy,
  calculatePayments,
  contextProblem,
  falseWinPayments,
  immediatePayments,
  maxCountFor,
  scoreHand,
  taiToPayout,
} from '../engine';
import { rulesetFor } from '../index';
import { houseRules } from '../rulesets/houseRules';
import { initialTable, nextTableState, seatWindOf, wallBreak } from '../../game/winds';

const players = ['a', 'b', 'c', 'd'];

describe('taiToPayout', () => {
  test('doubles per tai and stops at the cap', () => {
    const p = houseRules.payment;
    expect([1, 2, 3, 4, 5, 6].map((t) => taiToPayout(t, p))).toEqual([1, 2, 4, 8, 16, 16]);
  });
});

describe('scoreHand', () => {
  test('adds up stackable patterns', () => {
    const r = scoreHand(houseRules, [
      { id: 'dragon_pung', count: 2 },
      { id: 'half_flush', count: 1 },
    ]);
    expect(r.valid).toBe(true);
    expect(r.tai).toBe(4);
    expect(r.payout).toBe(8);
  });

  test('caps big hands', () => {
    const r = scoreHand(houseRules, [
      { id: 'full_flush', count: 1 },
      { id: 'all_pungs', count: 1 },
    ]);
    expect(r.rawTai).toBe(6);
    expect(r.tai).toBe(5);
    expect(r.capped).toBe(true);
  });

  test('limit hands score the max', () => {
    const r = scoreHand(houseRules, [{ id: 'thirteen_orphans', count: 1 }]);
    expect(r.isLimit).toBe(true);
    expect(r.tai).toBe(5);
  });

  test('rejects hands below the minimum', () => {
    expect(scoreHand(houseRules, []).valid).toBe(false);
  });

  test('rejects conflicting patterns once', () => {
    const r = scoreHand(houseRules, [
      { id: 'all_chows', count: 1 },
      { id: 'all_pungs', count: 1 },
    ]);
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveLength(1);
  });

  test('conflicts only name patterns that exist', () => {
    const ids = new Set(houseRules.patterns.map((p) => p.id));
    for (const p of houseRules.patterns) {
      for (const other of [...(p.excludes ?? []), ...Object.keys(p.caps ?? {})]) {
        expect(`${p.id} -> ${ids.has(other) ? 'ok' : other}`).toBe(`${p.id} -> ok`);
      }
    }
  });

  test.each([
    ['all_chows', 'seat_wind_pung'],
    ['all_chows', 'prevailing_wind_pung'],
    ['all_chows', 'dragon_pung'],
    ['all_chows', 'small_three_dragons'],
    ['all_chows', 'all_honours'],
    ['all_chows', 'kong_replacement'],
    ['full_flush', 'seat_wind_pung'],
    ['full_flush', 'small_four_winds'],
    ['half_flush', 'all_honours'],
    ['small_three_dragons', 'big_three_dragons'],
    ['small_four_winds', 'big_four_winds'],
    ['big_four_winds', 'dragon_pung'],
    ['thirteen_orphans', 'all_pungs'],
    ['nine_gates', 'dragon_pung'],
    ['all_pungs', 'robbing_kong'],
    ['robbing_kong', 'kong_replacement'],
    ['heavenly_hand', 'earthly_hand'],
  ])('%s clashes with %s', (a, b) => {
    const r = scoreHand(houseRules, [
      { id: a, count: 1 },
      { id: b, count: 1 },
    ]);
    expect(r.valid).toBe(false);
    expect(blockedBy(houseRules, [{ id: a, count: 1 }], b)?.id).toBe(a);
    expect(blockedBy(houseRules, [{ id: b, count: 1 }], a)?.id).toBe(b);
  });

  test('allows real combinations', () => {
    const ok = (ids: string[]) => scoreHand(houseRules, ids.map((id) => ({ id, count: 1 }))).valid;
    expect(ok(['all_chows', 'half_flush', 'concealed'])).toBe(true);
    expect(ok(['all_pungs', 'full_flush'])).toBe(true);
    expect(ok(['seat_wind_pung', 'prevailing_wind_pung', 'half_flush'])).toBe(true);
    expect(ok(['small_three_dragons', 'dragon_pung', 'half_flush'])).toBe(true);
    expect(ok(['thirteen_orphans', 'robbing_kong'])).toBe(true);
    expect(ok(['all_chows', 'robbing_kong'])).toBe(true);
  });

  test('small four winds leaves room for one dragon pung', () => {
    const swf = { id: 'small_four_winds', count: 1 };
    expect(maxCountFor(houseRules, [swf], 'dragon_pung').max).toBe(1);
    expect(scoreHand(houseRules, [swf, { id: 'dragon_pung', count: 1 }]).valid).toBe(true);
    const r = scoreHand(houseRules, [swf, { id: 'dragon_pung', count: 2 }]);
    expect(r.errors).toEqual(['Dragon pung or kong can only be counted once with Small four winds.']);
    expect(blockedBy(houseRules, [{ id: 'dragon_pung', count: 2 }], 'small_four_winds')?.id).toBe('dragon_pung');
  });

  test('three dragon pungs must be claimed as Big three dragons', () => {
    expect(scoreHand(houseRules, [{ id: 'dragon_pung', count: 3 }]).valid).toBe(false);
  });

  test('checks the win type and the dealer', () => {
    const one = (id: string) => [{ id, count: 1 }];
    expect(scoreHand(houseRules, one('kong_replacement'), { winType: 'discard' }).valid).toBe(false);
    expect(scoreHand(houseRules, one('kong_replacement'), { winType: 'selfDraw' }).valid).toBe(true);
    expect(scoreHand(houseRules, one('robbing_kong'), { winType: 'selfDraw' }).valid).toBe(false);
    expect(scoreHand(houseRules, one('heavenly_hand'), { winType: 'selfDraw', isDealer: false }).valid).toBe(false);
    expect(scoreHand(houseRules, one('heavenly_hand'), { winType: 'selfDraw', isDealer: true }).valid).toBe(true);
    expect(scoreHand(houseRules, one('earthly_hand'), { isDealer: true }).valid).toBe(false);
    // Unknown context isn't held against the hand.
    expect(scoreHand(houseRules, one('heavenly_hand')).valid).toBe(true);
    expect(contextProblem(houseRules.patterns.find((p) => p.id === 'robbing_kong')!, { winType: 'selfDraw' })).toBe(
      'Off a discard only',
    );
  });
});

describe('calculatePayments', () => {
  const payment = houseRules.payment;

  test('discard: shooter pays double, others single', () => {
    const d = calculatePayments({ playerIds: players, winnerId: 'a', winType: 'discard', discarderId: 'b', payout: 4, payment });
    expect(d).toEqual({ a: 16, b: -8, c: -4, d: -4 });
  });

  test('self-draw: everyone pays the multiplier', () => {
    const d = calculatePayments({ playerIds: players, winnerId: 'c', winType: 'selfDraw', discarderId: null, payout: 2, payment });
    expect(d).toEqual({ a: -4, b: -4, c: 12, d: -4 });
  });

  test('payments always sum to zero', () => {
    const d = calculatePayments({ playerIds: players, winnerId: 'd', winType: 'discard', discarderId: 'a', payout: 16, payment });
    expect(Object.values(d).reduce((s, v) => s + v, 0)).toBe(0);
  });
});

describe('immediatePayments', () => {
  const payout = (id: string) => houseRules.immediatePayouts.find((p) => p.id === id)!;
  const exposed = payout('exposed_kong');
  const concealed = payout('concealed_kong');
  const flowerPair = payout('flower_pair');

  test('everyone else pays the kong', () => {
    expect(immediatePayments(exposed, players, 'c', null)).toEqual({ a: -1, b: -1, c: 3, d: -1 });
    expect(immediatePayments(concealed, players, 'a', null)).toEqual({ a: 3, b: -1, c: -1, d: -1 });
  });

  test('a flower pair is paid by its owner, or by everyone if it’s your own', () => {
    expect(immediatePayments(flowerPair, players, 'a', 'c')).toEqual({ a: 1, b: 0, c: -1, d: 0 });
    expect(immediatePayments(flowerPair, players, 'a', 'a')).toEqual({ a: 3, b: -1, c: -1, d: -1 });
    expect(() => immediatePayments(flowerPair, players, 'a', null)).toThrow();
  });

  test('discarder-pays payouts need a discarder who isn’t the receiver', () => {
    const shooter = { ...exposed, payer: 'discarder' as const, amount: 3 };
    expect(immediatePayments(shooter, players, 'c', 'b')).toEqual({ a: 0, b: -3, c: 3, d: 0 });
    expect(() => immediatePayments(shooter, players, 'c', null)).toThrow();
    expect(() => immediatePayments(shooter, players, 'c', 'c')).toThrow();
  });
});

describe('game options', () => {
  test('max tai caps hands and sets what a limit hand scores', () => {
    const eight = rulesetFor('house', { maxTai: 8 });
    expect(scoreHand(eight, [{ id: 'thirteen_orphans', count: 1 }]).tai).toBe(8);
    expect(scoreHand(eight, [{ id: 'full_flush', count: 1 }, { id: 'all_pungs', count: 1 }]).tai).toBe(6);
    expect(scoreHand(rulesetFor('house', { maxTai: 3 }), [{ id: 'full_flush', count: 1 }]).tai).toBe(3);
  });

  test('a false win follows the game’s max tai', () => {
    expect(falseWinPayments(players, 'b', rulesetFor('house', { maxTai: 3 }).payment)).toEqual({ a: 3, b: -9, c: 3, d: 3 });
  });

  test('shooter pays for the table: the winner gets the same, all from the discarder', () => {
    const payment = rulesetFor('house', { discard: 'shooterOnly' }).payment;
    const pay = (payout: number, ids = players) =>
      calculatePayments({ playerIds: ids, winnerId: 'a', winType: 'discard', discarderId: 'b', payout, payment });
    expect(pay(1)).toEqual({ a: 4, b: -4, c: 0, d: 0 });
    expect(pay(4)).toEqual({ a: 16, b: -16, c: 0, d: 0 });
    expect(pay(1, ['a', 'b', 'c'])).toEqual({ a: 3, b: -3, c: 0 });
  });

  test('min tai', () => {
    expect(scoreHand(rulesetFor('house', { minTai: 3 }), [{ id: 'all_chows', count: 1 }]).valid).toBe(false);
    expect(scoreHand(rulesetFor('house', { minTai: 0 }), []).valid).toBe(true);
  });

  test('three players: self-draws and false wins only involve those at the table', () => {
    const three = ['a', 'b', 'c'];
    const payment = houseRules.payment;
    expect(calculatePayments({ playerIds: three, winnerId: 'a', winType: 'selfDraw', discarderId: null, payout: 2, payment })).toEqual({
      a: 8,
      b: -4,
      c: -4,
    });
    expect(falseWinPayments(three, 'c', payment)).toEqual({ a: 5, b: 5, c: -10 });
  });

  test('older games without options use the ruleset as it is', () => {
    expect(rulesetFor('house', undefined)).toBe(houseRules);
  });
});

describe('falseWinPayments', () => {
  test('the offender pays the max tai in points to each other player', () => {
    expect(falseWinPayments(players, 'b', houseRules.payment)).toEqual({ a: 5, b: -15, c: 5, d: 5 });
  });
});

describe('winds', () => {
  const rules = houseRules.rotation;

  test('a replayed hand keeps the dealer, the round and the streak', () => {
    const s = { ...initialTable(), dealerIndex: 2, dealerStreak: 1 };
    expect(nextTableState(s, { dealerWon: false, draw: false, replay: true }, rules)).toEqual({ ...s, handNumber: 2 });
  });

  test('dealer is always East', () => {
    expect([0, 1, 2, 3].map((i) => seatWindOf(i, 2))).toEqual([2, 3, 0, 1]);
  });

  test('dealer keeps the deal on a win', () => {
    const s = nextTableState(initialTable(), { dealerWon: true, draw: false }, rules);
    expect(s.dealerIndex).toBe(0);
    expect(s.dealerStreak).toBe(1);
  });

  test('the round wind moves on after the deal goes round the table', () => {
    let s = initialTable();
    for (let i = 0; i < 4; i++) s = nextTableState(s, { dealerWon: false, draw: false }, rules);
    expect(s.dealerIndex).toBe(0);
    expect(s.prevailingWind).toBe(1);
  });

  test('three players: the deal goes round three seats, and a game is 12 hands', () => {
    expect([0, 1, 2].map((i) => seatWindOf(i, 1, 3))).toEqual([2, 0, 1]);
    let s = initialTable();
    for (let i = 0; i < 3; i++) s = nextTableState(s, { dealerWon: false, draw: false }, rules, 3);
    expect(s.dealerIndex).toBe(0);
    expect(s.prevailingWind).toBe(1);
    for (let i = 0; i < 9; i++) s = nextTableState(s, { dealerWon: false, draw: false }, rules, 3);
    expect(s.finished).toBe(true);
  });

  test('the game finishes after the North round', () => {
    let s = initialTable();
    for (let i = 0; i < 16; i++) s = nextTableState(s, { dealerWon: false, draw: false }, rules);
    expect(s.finished).toBe(true);
  });

  test('dice count counter-clockwise from the dealer', () => {
    expect(wallBreak(5, 0).playerIndex).toBe(0);
    expect(wallBreak(6, 0).playerIndex).toBe(1);
    expect(wallBreak(7, 1).playerIndex).toBe(3);
    expect(wallBreak(12, 0).playerIndex).toBe(3);
  });
});
