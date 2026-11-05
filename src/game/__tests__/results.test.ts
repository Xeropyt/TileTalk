import { bestStats, gameResult, sumResults } from '../results';
import { emptyStats } from '../../types';
import type { HandRecord, Session } from '../../types';

const session = (id: string): Session =>
  ({
    id,
    groupId: 'g',
    rulesetId: 'house',
    players: [
      { id: 'me', uid: 'me', name: 'Me', avatar: '🀄' },
      { id: 'guest_b', uid: null, name: 'B', avatar: '🙂' },
      { id: 'u_c', uid: 'u_c', name: 'C', avatar: '🙂' },
      { id: 'u_d', uid: 'u_d', name: 'D', avatar: '🙂' },
    ],
    payouts: [{ payments: { me: 3, guest_b: -1, u_c: -1, u_d: -1 } }],
  }) as unknown as Session;

const hand = (h: Partial<HandRecord>): HandRecord =>
  ({ result: 'win', winType: 'discard', winnerId: null, discarderId: null, tai: 0, payments: {}, ...h }) as HandRecord;

describe('game results', () => {
  const hands = [
    hand({ winnerId: 'me', discarderId: 'u_c', tai: 3, payments: { me: 16, guest_b: -4, u_c: -8, u_d: -4 } }),
    hand({ winnerId: 'u_c', winType: 'selfDraw', tai: 2, payments: { me: -4, guest_b: -4, u_c: 12, u_d: -4 } }),
  ];

  test('one entry per seated account, guests left out', () => {
    const r = gameResult(session('s1'), hands);
    expect(r.uids).toEqual(['me', 'u_c', 'u_d']);
    expect(r.players.me).toEqual({ ...emptyStats(), handsPlayed: 2, wins: 1, totalTai: 3, taiWins: 1, biggestTai: 3, netPoints: 15 });
    expect(r.players.u_c.dealIns).toBe(1);
    expect(r.players.u_c.selfDraws).toBe(1);
  });

  test('games add up, and the biggest hand is the biggest of any game', () => {
    const totals = sumResults([gameResult(session('s1'), hands), gameResult(session('s2'), [hands[0]])]);
    expect(totals.me.handsPlayed).toBe(3);
    expect(totals.me.wins).toBe(2);
    expect(totals.me.netPoints).toBe(15 + 19);
    expect(totals.u_c.biggestTai).toBe(2);
  });

  test('ranks on whichever covers more hands', () => {
    const fromResults = { ...emptyStats(), handsPlayed: 30, wins: 9 };
    expect(bestStats({ ...emptyStats(), handsPlayed: 20 }, fromResults).wins).toBe(9);
    // Older games not in the results yet: the profile copy has more.
    expect(bestStats({ ...emptyStats(), handsPlayed: 50, wins: 12 }, fromResults).wins).toBe(12);
    expect(bestStats(undefined, undefined)).toEqual(emptyStats());
  });
});
