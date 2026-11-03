import { emptyStats, PlayerStats, UserProfile } from '../types';

export type LeaderboardSort = 'winRate' | 'wins' | 'netPoints' | 'biggestTai' | 'avgTai';

// One full game is 16 hands. Below that, a single lucky hand would top the rate-based boards.
export const MIN_HANDS_FOR_WIN_RATE = 16;
export const MIN_WINS_FOR_AVG_TAI = 5;

interface SortDef {
  label: string;
  value: (s: PlayerStats) => number;
  /** Players who don't meet this aren't ranked on this board yet. */
  eligible?: (s: PlayerStats) => boolean;
  eligibility?: string;
}

export const LEADERBOARD_SORTS: Record<LeaderboardSort, SortDef> = {
  winRate: {
    label: 'Win rate',
    value: (s) => (s.handsPlayed ? s.wins / s.handsPlayed : 0),
    eligible: (s) => s.handsPlayed >= MIN_HANDS_FOR_WIN_RATE,
    eligibility: `at least ${MIN_HANDS_FOR_WIN_RATE} hands`,
  },
  wins: { label: 'Wins', value: (s) => s.wins },
  netPoints: { label: 'Net points', value: (s) => s.netPoints },
  biggestTai: { label: 'Biggest hand', value: (s) => s.biggestTai },
  avgTai: {
    label: 'Average tai',
    value: (s) => (s.wins ? s.totalTai / s.wins : 0),
    eligible: (s) => s.wins >= MIN_WINS_FOR_AVG_TAI,
    eligibility: `at least ${MIN_WINS_FOR_AVG_TAI} wins`,
  },
};

export interface RankedPlayer {
  rank: number;
  profile: UserProfile;
  stats: PlayerStats;
  value: number;
}

/**
 * Ranks players on one stat, best first. Equal values share a rank (1, 1, 3), and more hands
 * played breaks the tie for display order. Returns how many players weren't eligible.
 */
export function rankPlayers(profiles: UserProfile[], sort: LeaderboardSort): { ranked: RankedPlayer[]; notRanked: number } {
  const def = LEADERBOARD_SORTS[sort];
  const rows = profiles.map((profile) => {
    const stats = { ...emptyStats(), ...profile.stats };
    return { profile, stats, value: def.value(stats) };
  });
  const eligible = rows.filter((r) => def.eligible?.(r.stats) ?? true);
  eligible.sort((a, b) => b.value - a.value || b.stats.handsPlayed - a.stats.handsPlayed);

  const ranked: RankedPlayer[] = [];
  eligible.forEach((r, i) => {
    const rank = i > 0 && r.value === eligible[i - 1].value ? ranked[i - 1].rank : i + 1;
    ranked.push({ ...r, rank });
  });
  return { ranked, notRanked: rows.length - eligible.length };
}
