import { computeTitles, ownedTitles, shownTitles } from '../titles';
import type { Group, HandRecord, Player, Session, UserProfile } from '../../types';

const ME = 'me';
const players: Player[] = [
  { id: ME, uid: ME, name: 'Me', avatar: '🀄' },
  { id: 'b', uid: 'b', name: 'B', avatar: '🙂' },
  { id: 'c', uid: 'c', name: 'C', avatar: '🙂' },
  { id: 'd', uid: null, name: 'D', avatar: '🙂' },
];

let clock = 0;
const session = (id: string, seats = ['me', 'b', 'c', 'd']): Session =>
  ({
    id,
    groupId: 'g1',
    players: seats.map((seat) => players.find((p) => p.id === seat)!),
    rulesetId: 'house',
    status: 'finished',
    scores: {},
    createdAt: { toMillis: () => ++clock },
  }) as unknown as Session;

/** A won hand: `winner` takes `amount` from `from` (or 2 from everyone on a self-draw). */
const win = (
  n: number,
  dealer: string,
  winner: string,
  from: string | null,
  patterns: string[] = [],
  tai = 1,
  amount = 4,
): HandRecord => {
  const payments: Record<string, number> = { me: 0, b: 0, c: 0, d: 0 };
  if (from) {
    payments[from] -= amount;
    payments[winner] += amount;
  } else {
    for (const p of players) if (p.id !== winner) (payments[p.id] -= 2), (payments[winner] += 2);
  }
  return {
    handNumber: n,
    prevailingWind: 0,
    dealerId: dealer,
    result: 'win',
    winType: from ? 'discard' : 'selfDraw',
    winnerId: winner,
    discarderId: from,
    patterns: patterns.map((id) => ({ id, count: 1 })),
    tai,
    payments,
  } as HandRecord;
};

/**
 * 16 hands in which a non-dealer always wins, so the deal passes every hand: exactly one full
 * game. `pick` chooses the winner, who paid, and how much.
 */
function fullGame(seats: string[], pick: (dealer: string) => [string, string, number?]): HandRecord[] {
  return Array.from({ length: 16 }, (_, i) => {
    const dealer = seats[i % 4];
    const [winner, from, amount] = pick(dealer);
    if (winner === dealer) throw new Error('A dealer win keeps the deal, so it would not be a 16-hand game');
    return { ...win(i + 1, dealer, winner, from, [], 1, amount), prevailingWind: Math.floor(i / 4) as 0 | 1 | 2 | 3 };
  });
}

const groups: Group[] = [{ id: 'g1', name: 'Friday table', ownerId: ME, memberIds: [ME, 'b', 'c'], members: {}, inviteCode: 'X' }];

describe('computeTitles', () => {
  test('a fresh player has nothing', () => {
    expect(computeTitles(ME, [], {}, groups)).toEqual({ permanent: [], held: [] });
  });

  test('pattern titles count winning hands with that pattern', () => {
    const s = session('s1');
    const hands = {
      s1: [
        win(1, 'b', ME, 'b', ['last_tile']),
        win(2, 'c', ME, 'c', ['last_tile', 'robbing_kong']),
        win(3, 'd', ME, 'c', ['last_tile']),
        win(4, 'b', 'b', ME, ['big_three_dragons'], 5),
      ],
    };
    const { permanent } = computeTitles(ME, [s], hands, groups);
    expect(permanent).toEqual(expect.arrayContaining(['first_blood', 'moon_fisher', 'kong_thief', 'limit_victim']));
    expect(permanent).not.toContain('limit_breaker');
    expect(permanent).not.toContain('kong_bloom');
  });

  test('wire to wire needs the lead after every hand of a full game', () => {
    // The first dealer can't lead after hand 1 without keeping the deal, so I sit second.
    const seats = ['b', ME, 'c', 'd'];
    const leadAll = fullGame(seats, (dealer) => (dealer === ME ? ['c', 'd', 4] : [ME, 'd', 8]));
    expect(computeTitles(ME, [session('s1', seats)], { s1: leadAll }, groups).permanent).toContain('wire_to_wire');

    // Same game, but C wins the first hand: I'm behind after hand 1.
    const lateStart = [{ ...leadAll[0], winnerId: 'c', payments: { me: 0, b: 0, c: 8, d: -8 } }, ...leadAll.slice(1)];
    expect(computeTitles(ME, [session('s1', seats)], { s1: lateStart }, groups).permanent).not.toContain('wire_to_wire');
  });

  test('ghost of the table: no wins in a full game, but not in a game ended early', () => {
    const seats = [ME, 'b', 'c', 'd'];
    const none = fullGame(seats, (dealer) => [dealer === 'b' ? 'c' : 'b', 'd']);
    expect(computeTitles(ME, [session('s1')], { s1: none }, groups).permanent).toContain('ghost_of_the_table');
    expect(computeTitles(ME, [session('s2')], { s2: none.slice(0, 8) }, groups).permanent).not.toContain('ghost_of_the_table');
  });

  test('dealer dynasty needs five kept deals in a row', () => {
    const kept = Array.from({ length: 5 }, (_, i) => win(i + 1, ME, ME, 'b'));
    expect(computeTitles(ME, [session('s1')], { s1: kept }, groups).permanent).toContain('dealer_dynasty');
    expect(computeTitles(ME, [session('s1')], { s1: kept.slice(0, 4) }, groups).permanent).not.toContain('dealer_dynasty');
  });

  test('founding member is never earned by playing', () => {
    const first = session('first');
    const { permanent } = computeTitles(ME, [first], { first: [win(1, 'b', ME, 'b')] }, groups);
    expect(permanent).not.toContain('founding_member');
  });

  test('za-hu counts false wins, which don’t count as hands or break the deal', () => {
    const falseWin = (n: number, by: string): HandRecord => ({
      ...win(n, 'b', by, null),
      result: 'falseWin',
      winnerId: null,
      winType: null,
      offenderId: by,
      payments: { me: by === ME ? -48 : 16, b: by === 'b' ? -48 : 16, c: 16, d: by === 'd' ? -48 : 16 },
    });
    const twice = [falseWin(1, ME), falseWin(2, ME)];
    expect(computeTitles(ME, [session('s1')], { s1: twice }, groups).permanent).not.toContain('za_hu');
    expect(computeTitles(ME, [session('s1')], { s1: [...twice, falseWin(3, ME)] }, groups).permanent).toContain('za_hu');

    // A full game with a false win in the middle is still a full game: the hand is replayed.
    const seats = [ME, 'b', 'c', 'd'];
    const none = fullGame(seats, (dealer) => [dealer === 'b' ? 'c' : 'b', 'd']);
    const withReplay = [...none.slice(0, 5), { ...falseWin(6, 'c'), dealerId: none[5].dealerId }, ...none.slice(5)].map(
      (h, i) => ({ ...h, handNumber: i + 1 }),
    );
    expect(computeTitles(ME, [session('s1')], { s1: withReplay }, groups).permanent).toContain('ghost_of_the_table');
  });

  test('held titles go to the single best player with 50+ hands in the group', () => {
    const s = session('s1');
    // 60 hands: I win every third, B wins the rest. C deals in to most of them.
    const hands = Array.from({ length: 60 }, (_, i) => win(i + 1, 'd', i % 3 === 0 ? ME : 'b', 'c'));
    const mine = computeTitles(ME, [s], { s1: hands }, groups).held;
    expect(mine).toEqual([]);
    expect(computeTitles('b', [s], { s1: hands }, groups).held).toEqual([
      { id: 'mahjongs_favourite', groupId: 'g1', groupName: 'Friday table' },
    ]);
    expect(computeTitles('c', [s], { s1: hands }, groups).held.map((h) => h.id)).toEqual(['generous_donor']);
    // Below 50 hands nobody qualifies.
    expect(computeTitles('b', [s], { s1: hands.slice(0, 49) }, groups).held).toEqual([]);
  });
});

describe('grant-only titles', () => {
  const base: UserProfile = { uid: ME, displayName: 'Me', avatar: '🀄', displayedTitles: ['founding_member'] };

  test('only count when the admin gave them', () => {
    expect(ownedTitles({ ...base, earnedTitles: ['founding_member'] })).toEqual([]);
    expect(shownTitles({ ...base, grantedTitles: ['founding_member'] }).map((t) => t.key)).toEqual(['founding_member']);
  });
});

describe('shownTitles', () => {
  const profile: UserProfile = {
    uid: ME,
    displayName: 'Me',
    avatar: '🀄',
    earnedTitles: ['first_blood', 'kong_thief'],
    heldTitles: [{ id: 'mahjongs_favourite', groupId: 'g1', groupName: 'Friday table' }],
    displayedTitles: ['mahjongs_favourite@g1', 'gone_title', 'kong_thief', 'mahjongs_favourite@g2'],
  };

  test('keeps the chosen order and drops titles the player no longer has', () => {
    expect(shownTitles(profile).map((t) => t.key)).toEqual(['mahjongs_favourite@g1', 'kong_thief']);
    expect(shownTitles(profile)[0].groupName).toBe('Friday table');
  });

  test('owned titles include held ones', () => {
    expect(ownedTitles(profile)).toHaveLength(3);
  });
});
