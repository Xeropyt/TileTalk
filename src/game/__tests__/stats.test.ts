import { computeStats } from '../stats';
import { averageTai, normaliseStats } from '../../types';
import type { HandRecord, Session } from '../../types';

const session = (id: string, uid: string): Session =>
  ({
    id,
    players: [
      { id: uid, uid, name: 'Me', avatar: '🀄' },
      { id: 'guest_b', uid: null, name: 'B', avatar: '🙂' },
      { id: 'u_c', uid: 'u_c', name: 'C', avatar: '🙂' },
      { id: 'u_d', uid: 'u_d', name: 'D', avatar: '🙂' },
    ],
  }) as Session;

const hand = (h: Partial<HandRecord>): HandRecord =>
  ({ result: 'win', winType: 'discard', winnerId: null, discarderId: null, tai: 0, payments: {}, ...h }) as HandRecord;

describe('computeStats', () => {
  const games = [session('g1', 'me'), session('g2', 'me')];
  const hands = {
    g1: [
      hand({ winnerId: 'me', discarderId: 'u_c', tai: 3, payments: { me: 16, guest_b: -4, u_c: -8, u_d: -4 } }),
      hand({ winnerId: 'u_c', discarderId: 'me', tai: 1, payments: { me: -2, guest_b: -1, u_c: 4, u_d: -1 } }),
      hand({ result: 'draw', winType: null }),
    ],
    g2: [hand({ winnerId: 'me', winType: 'selfDraw', tai: 5, payments: { me: 96, guest_b: -32, u_c: -32, u_d: -32 } })],
  };

  test('adds up every hand in every game', () => {
    expect(computeStats('me', games, hands)).toEqual({
      handsPlayed: 4,
      wins: 2,
      selfDraws: 1,
      dealIns: 1,
      totalTai: 8,
      taiWins: 2,
      biggestTai: 5,
      netPoints: 110,
    });
  });

  test('a deleted game drops out, including its biggest hand', () => {
    const s = computeStats('me', [games[0]], { g1: hands.g1 });
    expect(s.handsPlayed).toBe(3);
    expect(s.biggestTai).toBe(3);
    expect(s.netPoints).toBe(14);
  });

  test('a false win costs points but isn’t a hand played', () => {
    const penalty = hand({ result: 'falseWin', winType: null, offenderId: 'me', payments: { me: -48, guest_b: 16, u_c: 16, u_d: 16 } });
    const s = computeStats('me', [games[0]], { g1: [...hands.g1, penalty] });
    expect(s.handsPlayed).toBe(3);
    expect(s.netPoints).toBe(14 - 48);
  });

  test('immediate payouts count towards net points, not hands', () => {
    const withKong = {
      ...games[0],
      payouts: [{ id: 'k', type: 'concealed_kong', receiverId: 'me', payerId: null, handNumber: 1, payments: { me: 6, guest_b: -2, u_c: -2, u_d: -2 }, createdBy: 'me', at: 0 }],
    };
    const s = computeStats('me', [withKong], { g1: hands.g1 });
    expect(s.handsPlayed).toBe(3);
    expect(s.netPoints).toBe(14 + 6);
  });

  test('riichi: both double-ron winners get the win, and riichi points stay out of the tai stats', () => {
    const riichiGame = { ...session('r1', 'me'), rulesetId: 'riichi' } as Session;
    const doubleRon = hand({
      winnerId: 'u_c',
      discarderId: 'guest_b',
      tai: 3,
      payments: { me: 2000, guest_b: -5900, u_c: 3900, u_d: 0 },
      riichi: { winners: [{ playerId: 'u_c' }, { playerId: 'me' }] } as HandRecord['riichi'],
    });
    const s = computeStats('me', [riichiGame], { r1: [doubleRon] });
    expect([s.handsPlayed, s.wins, s.netPoints, s.totalTai, s.taiWins]).toEqual([1, 1, 0, 0, 0]);
  });

  test('average tai only divides by wins in tai games', () => {
    const riichiGame = { ...session('r1', 'me'), rulesetId: 'riichi' } as Session;
    const riichiWin = hand({ winnerId: 'me', discarderId: 'u_c', tai: 4, payments: {} });
    const s = computeStats('me', [...games, riichiGame], { ...hands, r1: [riichiWin, riichiWin] });
    expect(s.wins).toBe(4);
    expect(averageTai(s)).toBe(4); // (3 + 5) / 2 tai wins, not / 4 wins
  });

  test('Hong Kong faan count alongside House tai', () => {
    const hkGame = { ...session('hk1', 'me'), rulesetId: 'hongkong' } as Session;
    const hkWin = hand({ winnerId: 'me', discarderId: 'u_c', tai: 8, payments: { me: 256, guest_b: -64, u_c: -128, u_d: -64 } });
    const s = computeStats('me', [...games, hkGame], { ...hands, hk1: [hkWin] });
    expect(s.taiWins).toBe(3);
    expect(s.biggestTai).toBe(8);
    expect(averageTai(s)).toBe(16 / 3); // (3 + 5 + 8) / 3
    expect(s.netPoints).toBe(16 - 2 + 96 + 256);
  });

  test('profiles saved before taiWins existed count every win as a tai win', () => {
    const old = { handsPlayed: 10, wins: 4, selfDraws: 1, dealIns: 2, totalTai: 12, biggestTai: 5, netPoints: 9 };
    expect(averageTai(normaliseStats(old))).toBe(3);
    expect(normaliseStats(undefined).taiWins).toBe(0);
  });

  test('skips games the account wasn’t seated in', () => {
    expect(computeStats('someone_else', games, hands).handsPlayed).toBe(0);
  });
});
