import { findPattern, nextRiichiTable, riichiOptionsOf, Ruleset, rulesetFor } from '../scoring';
import type { Group, HandRecord, Session, UserProfile } from '../types';
import { computeStats } from './stats';
import { initialTable, nextTableState, RotationRules } from './winds';

export type TitleCategory = 'glory' | 'shame' | 'milestone';
export type TitleRarity = 'common' | 'rare' | 'legendary';

export interface TitleDef {
  id: string;
  name: string;
  chinese?: string;
  category: TitleCategory;
  rarity: TitleRarity;
  /** Only one player in each group holds it at a time, and it can be taken away. */
  held?: boolean;
  /** Never earned by playing. Only an admin can give it (enforced by the Firestore rules). */
  grantOnly?: boolean;
  unlock: string;
}

/** A held title, and the group it's held in. */
export interface HeldTitle {
  id: string;
  groupId: string;
  groupName: string;
}

export const CATEGORY_NAMES: Record<TitleCategory, string> = { glory: 'Glory', shame: 'Shame', milestone: 'Milestone' };
export const RARITY_NAMES: Record<TitleRarity, string> = { common: 'Common', rare: 'Rare', legendary: 'Legendary' };

/** How many titles a player can show on their public profile. */
export const MAX_SHOWN_TITLES = 3;

// "Full game" means it played through to the end of the North round, not ended early.
export const TITLES: TitleDef[] = [
  {
    id: 'mahjongs_favourite',
    name: 'Mahjong’s Favourite',
    chinese: '麻將寵兒',
    category: 'glory',
    rarity: 'rare',
    held: true,
    unlock: 'Highest win rate in the group over your last 50 hands there (minimum 50 hands).',
  },
  { id: 'wall_whisperer', name: 'Wall Whisperer', category: 'glory', rarity: 'rare', unlock: '40%+ of your wins are self-drawn (minimum 20 wins).' },
  { id: 'limit_breaker', name: 'Limit Breaker', category: 'glory', rarity: 'rare', unlock: 'Win any limit hand.' },
  { id: 'thirteen_orphans_club', name: 'Thirteen Orphans Club', category: 'glory', rarity: 'legendary', unlock: 'Win with Thirteen orphans.' },
  { id: 'heaven_sent', name: 'Heaven Sent', chinese: '天胡', category: 'glory', rarity: 'legendary', unlock: 'Win a Heavenly hand.' },
  { id: 'moon_fisher', name: 'Moon Fisher', chinese: '海底撈月', category: 'glory', rarity: 'rare', unlock: 'Win on the last tile 3 times.' },
  { id: 'kong_bloom', name: 'Kong Bloom', chinese: '槓上開花', category: 'glory', rarity: 'rare', unlock: 'Win on a kong replacement 3 times.' },
  { id: 'kong_thief', name: 'Kong Thief', category: 'glory', rarity: 'rare', unlock: 'Rob a kong.' },
  { id: 'dealer_dynasty', name: 'Dealer Dynasty', category: 'glory', rarity: 'rare', unlock: 'Keep the deal 5 hands in a row.' },
  { id: 'pure_blood', name: 'Pure Blood', category: 'glory', rarity: 'rare', unlock: 'Win 5 full flush hands.' },
  { id: 'great_wall', name: 'The Great Wall', category: 'glory', rarity: 'rare', unlock: 'Deal-in rate under 8% over your last 100 hands.' },
  { id: 'wire_to_wire', name: 'Wire to Wire', category: 'glory', rarity: 'rare', unlock: 'Lead the scores after every single hand of a full game.' },
  { id: 'comeback_kid', name: 'Comeback Kid', category: 'glory', rarity: 'rare', unlock: 'Finish a game first after being last at the end of the East round.' },
  { id: 'one_tai_merchant', name: '1-Tai Merchant', chinese: '一台王', category: 'shame', rarity: 'common', unlock: '70%+ of your wins are exactly 1 tai (minimum 20 wins).' },
  { id: 'za_hu', name: 'Za-hu', chinese: '詐胡', category: 'shame', rarity: 'common', unlock: 'Declare a false win 3 times.' },
  {
    id: 'generous_donor',
    name: 'Generous Donor',
    chinese: '放炮王',
    category: 'shame',
    rarity: 'common',
    held: true,
    unlock: 'Highest deal-in rate in the group (minimum 50 hands there).',
  },
  { id: 'feeding_frenzy', name: 'Feeding Frenzy', category: 'shame', rarity: 'common', unlock: 'Deal in 3 hands in a row.' },
  { id: 'ghost_of_the_table', name: 'Ghost of the Table', category: 'shame', rarity: 'common', unlock: 'Zero wins across a full game.' },
  { id: 'eternal_bridesmaid', name: 'Eternal Bridesmaid', category: 'shame', rarity: 'common', unlock: 'Finish second in 5 games in a row.' },
  { id: 'limit_victim', name: 'Limit Victim', category: 'shame', rarity: 'rare', unlock: 'Deal into someone’s limit hand.' },
  { id: 'one_and_done', name: 'One and Done', category: 'shame', rarity: 'common', unlock: 'Lose the deal on your very first hand as dealer 10 times.' },
  { id: 'big_hand_dreamer', name: 'Big Hand Dreamer', category: 'shame', rarity: 'common', unlock: '10 hands in a row where you neither win nor deal in.' },
  { id: 'first_blood', name: 'First Blood', category: 'milestone', rarity: 'common', unlock: 'Win your first hand.' },
  { id: 'regular', name: 'Regular', category: 'milestone', rarity: 'common', unlock: 'Play 10 games.' },
  { id: 'centurion', name: 'Centurion', category: 'milestone', rarity: 'common', unlock: 'Play 100 hands.' },
  { id: 'tile_veteran', name: 'Tile Veteran', category: 'milestone', rarity: 'rare', unlock: 'Play 1,000 hands.' },
  // Keep this id in step with GRANT_ONLY_TITLES in firestore.rules.
  {
    id: 'founding_member',
    name: 'Founding Member',
    category: 'milestone',
    rarity: 'legendary',
    grantOnly: true,
    unlock: 'Given personally by the TileTalk admin.',
  },
];

export function findTitle(id: string): TitleDef | undefined {
  return TITLES.find((t) => t.id === id);
}

/** How a title is stored in displayedTitles: held titles include their group. */
export function titleKey(id: string, groupId?: string): string {
  return groupId ? `${id}@${groupId}` : id;
}

export interface OwnedTitle {
  key: string;
  def: TitleDef;
  groupName?: string;
}

/**
 * Every title a profile has right now: earned ones, ones the admin gave, and held ones it still
 * holds. A grant-only title only counts if the admin gave it.
 */
export function ownedTitles(profile: UserProfile): OwnedTitle[] {
  const earned = (profile.earnedTitles ?? []).filter((id) => !findTitle(id)?.grantOnly);
  const granted = (profile.grantedTitles ?? []).filter((id) => findTitle(id)?.grantOnly);
  const permanent = [...new Set([...earned, ...granted])].flatMap((id) => {
    const def = findTitle(id);
    return def ? [{ key: id, def }] : [];
  });
  const held = (profile.heldTitles ?? []).flatMap((h) => {
    const def = findTitle(h.id);
    return def ? [{ key: titleKey(h.id, h.groupId), def, groupName: h.groupName }] : [];
  });
  return [...permanent, ...held];
}

/** The titles a player chose to show, skipping any they've since lost. */
export function shownTitles(profile: UserProfile): OwnedTitle[] {
  const owned = ownedTitles(profile);
  return (profile.displayedTitles ?? [])
    .flatMap((key) => owned.filter((o) => o.key === key))
    .slice(0, MAX_SHOWN_TITLES);
}

// ---------- Working titles out from game history ----------

interface Game {
  session: Session;
  hands: HandRecord[]; // in play order
  ruleset: Ruleset;
}

function chronological(sessions: Session[], handsBySession: Record<string, HandRecord[]>): Game[] {
  // Games still being written have no timestamp yet; they're the newest.
  const time = (s: Session) => s.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER;
  return [...sessions]
    .sort((a, b) => time(a) - time(b))
    .map((session) => ({
      session,
      hands: [...(handsBySession[session.id] ?? [])].sort((a, b) => a.handNumber - b.handNumber),
      ruleset: rulesetFor(session.rulesetId, session.options),
    }));
}

/** Replays the deal to see whether the game reached the end of the North round. */
function isFullGame(g: Game): boolean {
  if (g.hands.length === 0) return false;
  let table = initialTable();
  if (g.ruleset.scoringModel === 'hanFu') {
    const opts = riichiOptionsOf(g.ruleset, g.session.options, g.session.players.length);
    for (const h of g.hands) {
      if (!h.riichi) return false;
      table = nextRiichiTable(table, h.riichi.outcome, opts, g.session.players.length, h.riichi.sticksAfter);
    }
    return table.finished;
  }
  for (const h of g.hands) {
    table = nextTableState(
      table,
      { dealerWon: h.winnerId === h.dealerId, draw: h.result === 'draw', replay: h.result === 'falseWin' },
      g.ruleset.rotation,
      g.session.players.length,
    );
  }
  return table.finished;
}

/** Everyone's running score after each hand, including immediate payouts made during it. */
function runningScores(g: Game): Record<string, number>[] {
  let current: Record<string, number> = Object.fromEntries(g.session.players.map((p) => [p.id, 0]));
  const add = (payments: Record<string, number> = {}) => {
    for (const [pid, delta] of Object.entries(payments)) current[pid] = (current[pid] ?? 0) + delta;
  };
  return g.hands.map((h) => {
    current = { ...current };
    for (const p of g.session.payouts ?? []) if (p.handNumber === h.handNumber) add(p.payments);
    add(h.payments);
    return current;
  });
}

/** 1 for the top score. Players on the same score share a place. */
function placeOf(scores: Record<string, number>, pid: string): number {
  return 1 + Object.entries(scores).filter(([id, v]) => id !== pid && v > (scores[pid] ?? 0)).length;
}

const isOutright = (scores: Record<string, number>, pid: string, better: (a: number, b: number) => boolean) =>
  Object.entries(scores).every(([id, v]) => id === pid || better(scores[pid] ?? 0, v));

/** Top (or bottom), and not just because everyone is level. */
const isFirst = (s: Record<string, number>, pid: string) =>
  placeOf(s, pid) === 1 && Object.values(s).some((v) => v < (s[pid] ?? 0));
const isLast = (s: Record<string, number>, pid: string) =>
  Object.values(s).every((v) => v >= (s[pid] ?? 0)) && Object.values(s).some((v) => v > (s[pid] ?? 0));

function keptDeal(h: HandRecord, pid: string, rotation: RotationRules): boolean {
  return (wonBy(h, pid) && rotation.dealerStaysOnWin) || (h.result === 'draw' && rotation.dealerStaysOnDraw);
}

function longestRun(flags: boolean[]): number {
  let best = 0;
  let run = 0;
  for (const f of flags) {
    run = f ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

const isPlayed = (h: HandRecord) => h.result !== 'falseWin';
/** Did this player win the hand? A Riichi double ron has two winners, not just winnerId. */
const wonBy = (h: HandRecord, pid: string) =>
  h.riichi?.winners.length ? h.riichi.winners.some((w) => w.playerId === pid) : h.winnerId === pid;
const hasPattern = (h: HandRecord, id: string) => (h.patterns ?? []).some((p) => p.id === id && p.count > 0);
const hasLimitHand = (h: HandRecord, ruleset: Ruleset) =>
  (h.patterns ?? []).some((p) => p.count > 0 && findPattern(ruleset, p.id)?.limit);

/**
 * Works out which titles a player has earned from the games they can see. Permanent titles
 * come back as ids; held titles come back with the group they're held in.
 */
export function computeTitles(
  uid: string,
  sessions: Session[],
  handsBySession: Record<string, HandRecord[]>,
  groups: Group[],
): { permanent: string[]; held: HeldTitle[] } {
  const games = chronological(sessions, handsBySession);
  const stats = computeStats(uid, sessions, handsBySession);

  // Games I was seated in, with my player id in each. `played` leaves out false wins: those
  // hands were replayed, so they don't count towards streaks or hand counts.
  const mine = games.flatMap((g) => {
    const me = g.session.players.find((p) => p.uid === uid);
    return me && g.hands.length > 0 ? [{ ...g, me: me.id, played: g.hands.filter(isPlayed) }] : [];
  });
  const myHands = mine.flatMap((g) => g.played.map((h) => ({ h, me: g.me, ruleset: g.ruleset })));
  const myWins = myHands.filter((x) => wonBy(x.h, x.me));
  const winsWith = (id: string) => myWins.filter((x) => hasPattern(x.h, id)).length;
  const finished = mine.filter((g) => g.session.status === 'finished');
  const full = mine.filter(isFullGame);
  const last100 = myHands.slice(-100);

  const checks: Record<string, () => boolean> = {
    wall_whisperer: () => stats.wins >= 20 && stats.selfDraws / stats.wins >= 0.4,
    limit_breaker: () => myWins.some((x) => hasLimitHand(x.h, x.ruleset)),
    thirteen_orphans_club: () => winsWith('thirteen_orphans') >= 1,
    heaven_sent: () => winsWith('heavenly_hand') >= 1,
    moon_fisher: () => winsWith('last_tile') >= 3,
    kong_bloom: () => winsWith('kong_replacement') >= 3,
    kong_thief: () => winsWith('robbing_kong') >= 1,
    dealer_dynasty: () =>
      mine.some((g) => longestRun(g.played.map((h) => h.dealerId === g.me && keptDeal(h, g.me, g.ruleset.rotation))) >= 5),
    pure_blood: () => winsWith('full_flush') >= 5,
    great_wall: () => myHands.length >= 100 && last100.filter((x) => x.h.discarderId === x.me).length < 8,
    wire_to_wire: () => full.some((g) => runningScores(g).every((s) => isOutright(s, g.me, (a, b) => a > b))),
    comeback_kid: () =>
      finished.some((g) => {
        const scores = runningScores(g);
        const endOfEast = g.hands.map((h) => h.prevailingWind).lastIndexOf(0);
        if (endOfEast < 0 || endOfEast === g.hands.length - 1) return false; // never got past East
        return isLast(scores[endOfEast], g.me) && isFirst(scores[scores.length - 1], g.me);
      }),
    one_tai_merchant: () => {
      // Tai games only: a 1-han Riichi win isn't a 1-tai hand.
      const taiWins = myWins.filter((x) => x.ruleset.scoringModel === 'tai');
      return taiWins.length >= 20 && taiWins.filter((x) => x.h.tai === 1).length / taiWins.length >= 0.7;
    },
    za_hu: () => mine.flatMap((g) => g.hands.filter((h) => h.result === 'falseWin' && h.offenderId === g.me)).length >= 3,
    feeding_frenzy: () => longestRun(myHands.map((x) => x.h.discarderId === x.me)) >= 3,
    ghost_of_the_table: () => full.some((g) => !g.hands.some((h) => wonBy(h, g.me))),
    eternal_bridesmaid: () => longestRun(finished.map((g) => placeOf(g.session.scores, g.me) === 2)) >= 5,
    limit_victim: () => myHands.some((x) => x.h.discarderId === x.me && hasLimitHand(x.h, x.ruleset)),
    one_and_done: () =>
      mine.filter((g) => {
        const first = g.played.find((h) => h.dealerId === g.me);
        return !!first && !keptDeal(first, g.me, g.ruleset.rotation);
      }).length >= 10,
    big_hand_dreamer: () => longestRun(myHands.map((x) => !wonBy(x.h, x.me) && x.h.discarderId !== x.me)) >= 10,
    first_blood: () => stats.wins >= 1,
    regular: () => mine.length >= 10,
    centurion: () => stats.handsPlayed >= 100,
    tile_veteran: () => stats.handsPlayed >= 1000,
  };

  const permanent = TITLES.filter((t) => !t.held && !t.grantOnly && checks[t.id]?.()).map((t) => t.id);
  return { permanent, held: heldTitles(uid, games, groups) };
}

/**
 * The titles a player has: every permanent title they qualified for at some point in the games
 * that still exist, plus the group titles they hold now. Checked after each of their games, so a
 * title stays once earned (a later losing streak can't take away The Great Wall), but goes if the
 * games that earned it are deleted.
 */
export function earnedTitles(
  uid: string,
  sessions: Session[],
  handsBySession: Record<string, HandRecord[]>,
  groups: Group[],
): { permanent: string[]; held: HeldTitle[] } {
  const ordered = chronological(sessions, handsBySession).map((g) => g.session);
  const permanent = new Set<string>();
  const sofar: Session[] = [];
  for (const s of ordered) {
    sofar.push(s);
    // Permanent titles only depend on games the player sat in, so only those can add one.
    if (!s.players.some((p) => p.uid === uid) || !handsBySession[s.id]?.length) continue;
    for (const id of computeTitles(uid, sofar, handsBySession, []).permanent) permanent.add(id);
  }
  return {
    permanent: TITLES.filter((t) => permanent.has(t.id)).map((t) => t.id),
    held: computeTitles(uid, sessions, handsBySession, groups).held,
  };
}

/** Group titles: each goes to the single best (or worst) player among those with 50+ hands there. */
function heldTitles(uid: string, games: Game[], groups: Group[]): HeldTitle[] {
  const held: HeldTitle[] = [];
  for (const group of groups) {
    const perPlayer = new Map<string, { won: boolean; dealtIn: boolean }[]>();
    for (const g of games.filter((x) => x.session.groupId === group.id)) {
      for (const h of g.hands.filter(isPlayed)) {
        for (const p of g.session.players) {
          if (!p.uid) continue; // name-only guests can't hold titles
          const list = perPlayer.get(p.uid) ?? [];
          list.push({ won: wonBy(h, p.id), dealtIn: h.discarderId === p.id });
          perPlayer.set(p.uid, list);
        }
      }
    }
    const eligible = [...perPlayer].filter(([, hands]) => hands.length >= 50);
    const rate = (hands: { won: boolean; dealtIn: boolean }[], key: 'won' | 'dealtIn') =>
      hands.filter((h) => h[key]).length / hands.length;

    const holder = (score: (hands: { won: boolean; dealtIn: boolean }[]) => number) => {
      const ranked = eligible
        .map(([id, hands]) => ({ id, score: score(hands), count: hands.length }))
        .sort((a, b) => b.score - a.score || b.count - a.count);
      const [top, next] = ranked;
      if (!top || top.score <= 0) return null;
      // A dead heat on both rate and hands played means nobody holds it.
      if (next && next.score === top.score && next.count === top.count) return null;
      return top.id;
    };

    if (holder((hands) => rate(hands.slice(-50), 'won')) === uid) {
      held.push({ id: 'mahjongs_favourite', groupId: group.id, groupName: group.name });
    }
    if (holder((hands) => rate(hands, 'dealtIn')) === uid) {
      held.push({ id: 'generous_donor', groupId: group.id, groupName: group.name });
    }
  }
  return held;
}

// ---------- Progress towards titles ----------

/** How close a player is to something they haven't unlocked yet. */
export interface Progress {
  /** 0 to 1. */
  fraction: number;
  /** e.g. "7/10 games". */
  text: string;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
/** "7/10 games", capped at the target. */
export function countProgress(current: number, target: number, unit: string): Progress {
  return { fraction: clamp01(current / target), text: `${Math.min(current, target)}/${target} ${unit}` };
}

/** Counts that other unlocks depend on, beyond titles (e.g. profile themes). */
export interface PlayerCounts {
  /** Games sat in with at least one hand played, as the Regular title counts them. */
  gamesPlayed: number;
  /** Finished games where this player ended outright top. */
  gamesWon: number;
  /** Winning hands that were limit hands. */
  limitWins: number;
}

function myGames(uid: string, sessions: Session[], handsBySession: Record<string, HandRecord[]>) {
  return chronological(sessions, handsBySession).flatMap((g) => {
    const me = g.session.players.find((p) => p.uid === uid);
    return me && g.hands.length > 0 ? [{ ...g, me: me.id, played: g.hands.filter(isPlayed) }] : [];
  });
}

export function playerCounts(uid: string, sessions: Session[], handsBySession: Record<string, HandRecord[]>): PlayerCounts {
  const mine = myGames(uid, sessions, handsBySession);
  return {
    gamesPlayed: mine.length,
    gamesWon: mine.filter((g) => g.session.status === 'finished' && isFirst(g.session.scores, g.me)).length,
    limitWins: mine.reduce((n, g) => n + g.played.filter((h) => wonBy(h, g.me) && hasLimitHand(h, g.ruleset)).length, 0),
  };
}

/**
 * Progress towards every title, from the games the player can see. Streaks count the best run so
 * far. Titles with a minimum (20 wins, 100 hands) show that first, then the rate they need.
 */
export function titleProgress(
  uid: string,
  sessions: Session[],
  handsBySession: Record<string, HandRecord[]>,
  groups: Group[],
): Record<string, Progress> {
  const games = chronological(sessions, handsBySession);
  const stats = computeStats(uid, sessions, handsBySession);
  const mine = myGames(uid, sessions, handsBySession);
  const myHands = mine.flatMap((g) => g.played.map((h) => ({ h, me: g.me, ruleset: g.ruleset })));
  const myWins = myHands.filter((x) => wonBy(x.h, x.me));
  const winsWith = (id: string) => myWins.filter((x) => hasPattern(x.h, id)).length;
  const finished = mine.filter((g) => g.session.status === 'finished');
  const full = mine.filter(isFullGame);
  const once = (done: boolean, unit: string) => countProgress(done ? 1 : 0, 1, unit);
  const percentOf = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

  // Group titles need 50 hands in one group, then the best (or worst) record there.
  const groupHands = (groupId: string) =>
    games
      .filter((g) => g.session.groupId === groupId && g.session.players.some((p) => p.uid === uid))
      .reduce((n, g) => n + g.hands.filter(isPlayed).length, 0);
  const bestGroupHands = Math.max(0, ...groups.map((g) => groupHands(g.id)));
  const groupTitle = (goal: string): Progress =>
    bestGroupHands < 50
      ? countProgress(bestGroupHands, 50, 'hands in one group')
      : { fraction: 0.9, text: `50/50 hands. Now ${goal} in the group` };

  const taiWins = myWins.filter((x) => x.ruleset.scoringModel === 'tai');
  const dealInsLast100 = myHands.slice(-100).filter((x) => x.h.discarderId === x.me).length;
  const rate = (pct: number, needed: number, what: string): Progress => ({
    fraction: clamp01(pct / needed),
    text: `${pct}% ${what} (${needed}% needed)`,
  });

  const progress: Record<string, () => Progress> = {
    mahjongs_favourite: () => groupTitle('have the best win rate'),
    wall_whisperer: () =>
      stats.wins < 20 ? countProgress(stats.wins, 20, 'wins') : rate(percentOf(stats.selfDraws, stats.wins), 40, 'of wins self-drawn'),
    limit_breaker: () => countProgress(myWins.filter((x) => hasLimitHand(x.h, x.ruleset)).length, 1, 'limit hand'),
    thirteen_orphans_club: () => countProgress(winsWith('thirteen_orphans'), 1, 'thirteen orphans'),
    heaven_sent: () => countProgress(winsWith('heavenly_hand'), 1, 'heavenly hand'),
    moon_fisher: () => countProgress(winsWith('last_tile'), 3, 'last-tile wins'),
    kong_bloom: () => countProgress(winsWith('kong_replacement'), 3, 'kong replacement wins'),
    kong_thief: () => countProgress(winsWith('robbing_kong'), 1, 'robbed kong'),
    dealer_dynasty: () =>
      countProgress(
        Math.max(0, ...mine.map((g) => longestRun(g.played.map((h) => h.dealerId === g.me && keptDeal(h, g.me, g.ruleset.rotation))))),
        5,
        'deals kept in a row',
      ),
    pure_blood: () => countProgress(winsWith('full_flush'), 5, 'full flush wins'),
    great_wall: () =>
      myHands.length < 100
        ? countProgress(myHands.length, 100, 'hands')
        : {
            fraction: dealInsLast100 < 8 ? 1 : clamp01(7 / dealInsLast100),
            text: `${dealInsLast100} deal-ins in your last 100 hands (under 8 needed)`,
          },
    wire_to_wire: () => once(full.some((g) => runningScores(g).every((s) => isOutright(s, g.me, (a, b) => a > b))), 'game led wire to wire'),
    comeback_kid: () =>
      once(
        finished.some((g) => {
          const scores = runningScores(g);
          const endOfEast = g.hands.map((h) => h.prevailingWind).lastIndexOf(0);
          if (endOfEast < 0 || endOfEast === g.hands.length - 1) return false;
          return isLast(scores[endOfEast], g.me) && isFirst(scores[scores.length - 1], g.me);
        }),
        'comeback',
      ),
    one_tai_merchant: () =>
      taiWins.length < 20
        ? countProgress(taiWins.length, 20, 'wins')
        : rate(percentOf(taiWins.filter((x) => x.h.tai === 1).length, taiWins.length), 70, 'of wins at 1 tai'),
    za_hu: () => countProgress(mine.flatMap((g) => g.hands.filter((h) => h.result === 'falseWin' && h.offenderId === g.me)).length, 3, 'false wins'),
    generous_donor: () => groupTitle('have the highest deal-in rate'),
    feeding_frenzy: () => countProgress(longestRun(myHands.map((x) => x.h.discarderId === x.me)), 3, 'deal-ins in a row'),
    ghost_of_the_table: () => once(full.some((g) => !g.hands.some((h) => wonBy(h, g.me))), 'winless full game'),
    eternal_bridesmaid: () => countProgress(longestRun(finished.map((g) => placeOf(g.session.scores, g.me) === 2)), 5, 'second places in a row'),
    limit_victim: () => countProgress(myHands.filter((x) => x.h.discarderId === x.me && hasLimitHand(x.h, x.ruleset)).length, 1, 'limit hand dealt into'),
    one_and_done: () =>
      countProgress(
        mine.filter((g) => {
          const first = g.played.find((h) => h.dealerId === g.me);
          return !!first && !keptDeal(first, g.me, g.ruleset.rotation);
        }).length,
        10,
        'first deals lost',
      ),
    big_hand_dreamer: () => countProgress(longestRun(myHands.map((x) => !wonBy(x.h, x.me) && x.h.discarderId !== x.me)), 10, 'quiet hands in a row'),
    first_blood: () => countProgress(stats.wins, 1, 'win'),
    regular: () => countProgress(mine.length, 10, 'games'),
    centurion: () => countProgress(stats.handsPlayed, 100, 'hands'),
    tile_veteran: () => countProgress(stats.handsPlayed, 1000, 'hands'),
    founding_member: () => ({ fraction: 0, text: 'Only the admin can give this' }),
  };
  return Object.fromEntries(TITLES.map((t) => [t.id, progress[t.id]?.() ?? { fraction: 0, text: '' }]));
}
