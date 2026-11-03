import { rankPlayers } from '../leaderboard';
import { emptyStats, PlayerStats, UserProfile } from '../../types';

const player = (uid: string, stats: Partial<PlayerStats>): UserProfile => ({
  uid,
  displayName: uid,
  avatar: '🀄',
  registered: true,
  stats: { ...emptyStats(), ...stats },
});

const ids = (r: ReturnType<typeof rankPlayers>) => r.ranked.map((p) => `${p.rank}:${p.profile.uid}`);

describe('rankPlayers', () => {
  const players = [
    player('amy', { handsPlayed: 40, wins: 12, totalTai: 30, biggestTai: 5, netPoints: 50 }),
    player('ben', { handsPlayed: 20, wins: 8, totalTai: 24, biggestTai: 4, netPoints: -10 }),
    player('cat', { handsPlayed: 3, wins: 3, totalTai: 15, biggestTai: 5, netPoints: 90 }),
    player('dan', {}),
  ];

  test('wins, best first', () => {
    expect(ids(rankPlayers(players, 'wins'))).toEqual(['1:amy', '2:ben', '3:cat', '4:dan']);
  });

  test('ties share a rank, and more hands played is listed first', () => {
    expect(ids(rankPlayers(players, 'biggestTai'))).toEqual(['1:amy', '1:cat', '3:ben', '4:dan']);
  });

  test('net points can be negative', () => {
    expect(ids(rankPlayers(players, 'netPoints'))).toEqual(['1:cat', '2:amy', '3:dan', '4:ben']);
  });

  test('win rate only ranks players with enough hands', () => {
    const r = rankPlayers(players, 'winRate');
    expect(ids(r)).toEqual(['1:ben', '2:amy']);
    expect(r.notRanked).toBe(2);
  });

  test('average tai only ranks players with enough wins', () => {
    const r = rankPlayers(players, 'avgTai');
    expect(ids(r)).toEqual(['1:ben', '2:amy']);
    expect(r.ranked[0].value).toBe(3);
  });

  test('players who never published stats count as zero', () => {
    const r = rankPlayers([{ uid: 'new', displayName: 'New', avatar: '🀄', registered: true }], 'wins');
    expect(r.ranked[0].value).toBe(0);
  });
});
