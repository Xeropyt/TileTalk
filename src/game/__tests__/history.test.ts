import { formatClock, formatDuration, handName, payoutTotals } from '../history';
import { immediatePayments } from '../../scoring/engine';
import { houseRules } from '../../scoring/rulesets/houseRules';
import type { PayoutRecord, Player } from '../../types';

describe('handName', () => {
  test('names the hand by its patterns, the big ones first and flowers last', () => {
    const name = handName(houseRules, [
      { id: 'seat_flower', count: 1 },
      { id: 'all_pungs', count: 1 },
      { id: 'dragon_pung', count: 2 },
    ]);
    expect(name).toBe('All pungs + Dragon pung ×2 + Own flower');
  });

  test('limit hands lead', () => {
    expect(handName(houseRules, [{ id: 'seat_flower', count: 1 }, { id: 'big_three_dragons', count: 1 }])).toBe(
      'Big three dragons + Own flower',
    );
  });

  test('nothing claimed, or unknown patterns, gives no name', () => {
    expect(handName(houseRules, [])).toBeNull();
    expect(handName(houseRules, [{ id: 'gone', count: 1 }, { id: 'all_pungs', count: 0 }])).toBeNull();
  });
});

describe('payoutTotals', () => {
  const players = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, avatar: '', uid: null })) as Player[];
  const ids = players.map((p) => p.id);
  const def = (id: string) => houseRules.immediatePayouts.find((d) => d.id === id)!;
  const record = (payments: Record<string, number>) => ({ payments }) as PayoutRecord;

  test('adds up what each player earned and lost', () => {
    const totals = payoutTotals(players, [
      record(immediatePayments(def('exposed_kong'), ids, 'a', null)),
      record(immediatePayments(def('discard_kong'), ids, 'b', 'a')),
    ]);
    expect(totals).toEqual([
      { playerId: 'a', earned: 3, lost: 2, net: 1 },
      { playerId: 'b', earned: 2, lost: 1, net: 1 },
      { playerId: 'c', earned: 0, lost: 1, net: -1 },
      { playerId: 'd', earned: 0, lost: 1, net: -1 },
    ]);
  });

  test('a kong off a discard is 2 from the discarder only', () => {
    expect(immediatePayments(def('discard_kong'), ids, 'b', 'c')).toEqual({ a: 0, b: 2, c: -2, d: 0 });
  });
});

describe('time', () => {
  test('clock', () => {
    expect(formatClock(9_000)).toBe('0:09');
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(3_909_000)).toBe('1:05:09');
  });

  test('duration', () => {
    expect(formatDuration(20_000)).toBe('0m');
    expect(formatDuration(45 * 60_000)).toBe('45m');
    expect(formatDuration(60 * 60_000)).toBe('1h');
    expect(formatDuration(125 * 60_000)).toBe('2h 5m');
  });
});
