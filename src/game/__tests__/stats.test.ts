import { computeStats } from '../stats';
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

  test('skips games the account wasn’t seated in', () => {
    expect(computeStats('someone_else', games, hands).handsPlayed).toBe(0);
  });
});
