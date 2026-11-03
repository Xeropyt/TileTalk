import { bestWin, lastFinishedGame } from '../hub';
import { BONUS_TILES, HAND_TILES, maxCopies, sortTiles, tileName } from '../tiles';
import type { HandRecord, Session } from '../../types';

const game = (id: string, status: Session['status'], seated = true): Session =>
  ({ id, status, players: [{ id: 'p1', uid: seated ? 'me' : 'x', name: 'Me', avatar: '🀄' }] }) as unknown as Session;
const hand = (n: number, h: Partial<HandRecord>): HandRecord =>
  ({ handNumber: n, result: 'win', winnerId: 'p1', tai: 1, patterns: [], payments: {}, ...h }) as HandRecord;

describe('lastFinishedGame', () => {
  test('skips games in progress and games I sat out', () => {
    const sessions = [game('live', 'active'), game('notMe', 'finished', false), game('mine', 'finished'), game('old', 'finished')];
    expect(lastFinishedGame('me', sessions)?.id).toBe('mine');
    expect(lastFinishedGame('me', [game('live', 'active')])).toBeNull();
  });
});

describe('bestWin', () => {
  test('picks my highest tai, the later hand on a tie, and ignores other results', () => {
    const hands = [
      hand(1, { tai: 3 }),
      hand(2, { tai: 5, winnerId: 'p2' }),
      hand(3, { tai: 3 }),
      hand(4, { result: 'falseWin', winnerId: null, tai: 0 }),
    ];
    expect(bestWin('me', game('g', 'finished'), hands)?.handNumber).toBe(3);
    expect(bestWin('me', game('g', 'finished'), [hand(1, { winnerId: 'p2' })])).toBeNull();
  });
});

describe('tiles', () => {
  test('there are 34 kinds of tile plus 8 flowers and seasons', () => {
    expect(HAND_TILES).toHaveLength(34);
    expect(BONUS_TILES).toHaveLength(8);
    expect(maxCopies('man5')).toBe(4);
    expect(maxCopies('season2')).toBe(1);
  });

  test('sorts by suit, then honours', () => {
    expect(sortTiles(['red', 'sou2', 'east', 'man9', 'pin1', 'man1'])).toEqual(['man1', 'man9', 'pin1', 'sou2', 'east', 'red']);
  });

  test('names tiles for screen readers', () => {
    expect(tileName('pin7')).toBe('7 of Dots');
    expect(tileName('green')).toBe('Green dragon');
    expect(tileName('flower3')).toBe('Chrysanthemum (flower 3)');
  });
});
