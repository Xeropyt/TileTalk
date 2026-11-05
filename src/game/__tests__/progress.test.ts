import { findProfileTheme, PROFILE_THEMES, profileThemeStatus, sortByProgress } from '../profileThemes';
import { countProgress, playerCounts, titleProgress, TITLES } from '../titles';
import type { HandRecord, Session } from '../../types';

let clock = 0;
const game = (id: string, scores: Record<string, number>, status: 'active' | 'finished' = 'finished'): Session => {
  const at = ++clock;
  return {
    id,
    groupId: 'g',
    rulesetId: 'house',
    status,
    players: ['me', 'b', 'c', 'd'].map((p) => ({ id: p, uid: p === 'me' ? 'me' : null, name: p, avatar: '' })),
    scores,
    table: {},
    createdAt: { toMillis: () => at },
  } as unknown as Session;
};
const hand = (n: number, h: Partial<HandRecord>): HandRecord =>
  ({ id: `h${n}`, handNumber: n, prevailingWind: 0, dealerId: 'b', result: 'win', winType: 'discard', winnerId: 'b', discarderId: 'c', patterns: [], tai: 1, payments: {}, ...h }) as HandRecord;

describe('progress', () => {
  test('counts read like 7/10 and stop at the target', () => {
    expect(countProgress(7, 10, 'games')).toEqual({ fraction: 0.7, text: '7/10 games' });
    expect(countProgress(15, 10, 'games')).toEqual({ fraction: 1, text: '10/10 games' });
  });

  const sessions = [game('a', { me: 30, b: -10, c: -10, d: -10 }), game('b', { me: -5, b: 5, c: 0, d: 0 }), game('c', { me: 0, b: 0, c: 0, d: 0 }, 'active')];
  const hands = {
    a: [hand(1, { winnerId: 'me', tai: 5, patterns: [{ id: 'big_three_dragons', count: 1 }] }), hand(2, { discarderId: 'me' })],
    b: [hand(1, { winnerId: 'me', tai: 3, patterns: [{ id: 'all_pungs', count: 1 }] })],
    c: [hand(1, {})],
  };

  test('games played, games won (finishing first, not hands) and limit wins', () => {
    expect(playerCounts('me', sessions, hands)).toEqual({ gamesPlayed: 3, gamesWon: 1, limitWins: 1 });
  });

  test('title progress for counted titles', () => {
    const p = titleProgress('me', sessions, hands, []);
    expect(p.regular.text).toBe('3/10 games');
    expect(p.centurion.text).toBe('4/100 hands');
    expect(p.limit_breaker.fraction).toBe(1);
    expect(p.pure_blood.text).toBe('0/5 full flush wins');
    expect(p.founding_member.fraction).toBe(0);
    expect(Object.keys(p).sort()).toEqual(TITLES.map((t) => t.id).sort());
  });

  test('rate titles show the minimum first', () => {
    expect(titleProgress('me', sessions, hands, []).wall_whisperer.text).toBe('2/20 wins');
  });
});

describe('profile themes', () => {
  const counts = { gamesPlayed: 4, gamesWon: 10, limitWins: 0, likesGiven: 9 };

  test('Classic and Cyber are free, the rest unlock as asked', () => {
    const status = Object.fromEntries(PROFILE_THEMES.map((t) => [t.id, profileThemeStatus(t, counts, false)]));
    expect(status.classic.unlocked).toBe(true);
    expect(status.cyber.unlocked).toBe(true);
    expect(status.jade).toEqual({ unlocked: false, progress: { fraction: 0.4, text: '4/10 games played' } });
    expect(status.royal.unlocked).toBe(true);
    expect(status.sakura.progress!.text).toBe('9/10 posts liked');
    expect(status.imperial.progress!.text).toBe('0/1 limit hand won');
  });

  test('admins have every design', () => {
    expect(PROFILE_THEMES.every((t) => profileThemeStatus(t, counts, true).unlocked)).toBe(true);
  });

  test('closest to unlock comes first', () => {
    const order = sortByProgress(PROFILE_THEMES, (t) => profileThemeStatus(t, counts, false).progress?.fraction ?? 1).map((t) => t.id);
    expect(order).toEqual(['classic', 'cyber', 'royal', 'sakura', 'jade', 'imperial']);
  });

  test('unknown designs fall back to Classic', () => {
    expect(findProfileTheme('nope').id).toBe('classic');
  });
});
