import { findPattern, getRuleset, Ruleset } from '../scoring';
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
      ruleset: getRuleset(session.rulesetId),
    }));
}

/** Replays the deal to see whether the game reached the end of the North round. */
function isFullGame(g: Game): boolean {
  if (g.hands.length === 0) return false;
  let table = initialTable();
  for (const h of g.hands) {
    table = nextTableState(
      table,
      { dealerWon: h.winnerId === h.dealerId, draw: h.result === 'draw', replay: h.result === 'falseWin' },
      g.ruleset.rotation,
    );
  }
  return table.finished;
}

/** Everyone's running score after each hand. */
function runningScores(g: Game): Record<string, number>[] {
  let current: Record<string, number> = Object.fromEntries(g.session.players.map((p) => [p.id, 0]));
  return g.hands.map((h) => {
    current = { ...current };
    for (const [pid, delta] of Object.entries(h.payments ?? {})) current[pid] = (current[pid] ?? 0) + delta;
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
  return (h.winnerId === pid && rotation.dealerStaysOnWin) || (h.result === 'draw' && rotation.dealerStaysOnDraw);
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
  const myWins = myHands.filter((x) => x.h.winnerId === x.me);
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
    one_tai_merchant: () => stats.wins >= 20 && myWins.filter((x) => x.h.tai === 1).length / stats.wins >= 0.7,
    za_hu: () => mine.flatMap((g) => g.hands.filter((h) => h.result === 'falseWin' && h.offenderId === g.me)).length >= 3,
    feeding_frenzy: () => longestRun(myHands.map((x) => x.h.discarderId === x.me)) >= 3,
    ghost_of_the_table: () => full.some((g) => !g.hands.some((h) => h.winnerId === g.me)),
    eternal_bridesmaid: () => longestRun(finished.map((g) => placeOf(g.session.scores, g.me) === 2)) >= 5,
    limit_victim: () => myHands.some((x) => x.h.discarderId === x.me && hasLimitHand(x.h, x.ruleset)),
    one_and_done: () =>
      mine.filter((g) => {
        const first = g.played.find((h) => h.dealerId === g.me);
        return !!first && !keptDeal(first, g.me, g.ruleset.rotation);
      }).length >= 10,
    big_hand_dreamer: () => longestRun(myHands.map((x) => x.h.winnerId !== x.me && x.h.discarderId !== x.me)) >= 10,
    first_blood: () => stats.wins >= 1,
    regular: () => mine.length >= 10,
    centurion: () => stats.handsPlayed >= 100,
    tile_veteran: () => stats.handsPlayed >= 1000,
  };

  const permanent = TITLES.filter((t) => !t.held && !t.grantOnly && checks[t.id]?.()).map((t) => t.id);
  return { permanent, held: heldTitles(uid, games, groups) };
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
          list.push({ won: h.winnerId === p.id, dealtIn: h.discarderId === p.id });
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
