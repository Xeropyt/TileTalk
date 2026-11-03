import type { ClaimedPattern, WinType } from './scoring/types';
import type { HeldTitle } from './game/titles';
import type { TableState } from './game/winds';

export interface PlayerStats {
  handsPlayed: number;
  wins: number;
  selfDraws: number;
  dealIns: number;
  totalTai: number;
  biggestTai: number;
  netPoints: number;
}

export function emptyStats(): PlayerStats {
  return { handsPlayed: 0, wins: 0, selfDraws: 0, dealIns: 0, totalTai: 0, biggestTai: 0, netPoints: 0 };
}

export interface UserProfile {
  uid: string;
  displayName: string;
  avatar: string;
  /**
   * A copy of this player's career stats for the leaderboard. The saved hands are the real
   * record; the player's own app refreshes this copy (see usePublishRecord).
   */
  stats?: PlayerStats;
  /** Has an account, so appears on the leaderboard. Guests don't. */
  registered?: boolean;
  /** Permanent titles. Once earned they're kept, even if the games behind them are deleted. */
  earnedTitles?: string[];
  /** Titles only the admin can give, such as Founding Member. Only an admin can write this. */
  grantedTitles?: string[];
  /** Group titles this player holds right now. */
  heldTitles?: HeldTitle[];
  /** Title keys (see titleKey) the player chose to show publicly, best first. */
  displayedTitles?: string[];
}

export interface GroupMember {
  name: string;
  avatar: string;
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  members: Record<string, GroupMember>;
  inviteCode: string;
}

/** A seat at the table. Guests have no account, so uid is null and their stats aren't tracked. */
export interface Player {
  id: string;
  name: string;
  avatar: string;
  uid: string | null;
}

export interface Session {
  id: string;
  groupId: string;
  memberIds: string[];
  players: Player[]; // fixed seat order, index 0 starts as East
  rulesetId: string;
  rulesetName: string;
  table: TableState;
  scores: Record<string, number>;
  status: 'active' | 'finished';
  createdBy: string;
  createdAt?: { toMillis(): number } | null;
}

export type HandResult = 'win' | 'draw' | 'falseWin';

export interface HandRecord {
  id: string;
  handNumber: number;
  prevailingWind: number;
  dealerId: string;
  /** falseWin: someone declared a win they didn't have (詐胡), and the hand was replayed. */
  result: HandResult;
  winType: WinType | null;
  winnerId: string | null;
  discarderId: string | null;
  /** Who declared the false win. Only set when result is falseWin. */
  offenderId?: string | null;
  patterns: ClaimedPattern[];
  tai: number;
  payout: number;
  payments: Record<string, number>;
  createdBy: string;
  createdAt?: { toMillis(): number } | null;
}
