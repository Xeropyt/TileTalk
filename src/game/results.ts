import { emptyStats, HandRecord, normaliseStats, PlayerStats, Session } from '../types';
import { computeStats } from './stats';

/**
 * A finished game's contribution to each seated account's career stats. Saved once the game
 * ends, so the leaderboard can add games up without anyone opening the app. Readable by
 * everyone; the games themselves are only readable by their group.
 */
export interface GameResult {
  /** The game's id. */
  id: string;
  groupId: string;
  rulesetId: string;
  /** Seated accounts, for looking up one player's results. */
  uids: string[];
  players: Record<string, PlayerStats>;
  /** Bump RESULTS_VERSION to have every result written again, e.g. after a stats change. */
  version: number;
}

export const RESULTS_VERSION = 1;

/** What one finished game adds to each seated account's stats. */
export function gameResult(session: Session, hands: HandRecord[]): GameResult {
  const uids = [...new Set(session.players.map((p) => p.uid).filter((u): u is string => !!u))];
  const players = Object.fromEntries(uids.map((uid) => [uid, computeStats(uid, [session], { [session.id]: hands })]));
  return { id: session.id, groupId: session.groupId, rulesetId: session.rulesetId, uids, players, version: RESULTS_VERSION };
}

/** Adds up every game's results for each account. */
export function sumResults(results: GameResult[]): Record<string, PlayerStats> {
  const totals: Record<string, PlayerStats> = {};
  for (const r of results) {
    for (const [uid, raw] of Object.entries(r.players ?? {})) {
      const s = normaliseStats(raw);
      const t = (totals[uid] ??= emptyStats());
      t.handsPlayed += s.handsPlayed;
      t.wins += s.wins;
      t.selfDraws += s.selfDraws;
      t.dealIns += s.dealIns;
      t.totalTai += s.totalTai;
      t.taiWins += s.taiWins;
      t.netPoints += s.netPoints;
      t.biggestTai = Math.max(t.biggestTai, s.biggestTai);
    }
  }
  return totals;
}

/**
 * The stats to rank a player on. Game results are up to date the moment a game ends; the copy
 * on the profile is only refreshed by the player's own app. Games from before results were
 * saved only reach the results once someone at that table opens the app, so until then the
 * profile copy can be more complete. Use whichever covers more hands.
 */
export function bestStats(published: Partial<PlayerStats> | undefined, fromResults: PlayerStats | undefined): PlayerStats {
  const profile = normaliseStats(published);
  if (!fromResults) return profile;
  return fromResults.handsPlayed >= profile.handsPlayed ? fromResults : profile;
}
