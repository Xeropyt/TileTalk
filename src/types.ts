import type { RiichiOutcome, RiichiWinner } from './scoring/riichi';
import type { ClaimedPattern, GameOptions, WinType } from './scoring/types';
import type { HeldTitle } from './game/titles';
import type { TableState } from './game/winds';

export interface PlayerStats {
  handsPlayed: number;
  wins: number;
  selfDraws: number;
  dealIns: number;
  totalTai: number;
  /** Wins in tai games. Average tai divides by this, since Riichi wins have no tai. */
  taiWins: number;
  biggestTai: number;
  netPoints: number;
}

export function emptyStats(): PlayerStats {
  return { handsPlayed: 0, wins: 0, selfDraws: 0, dealIns: 0, totalTai: 0, taiWins: 0, biggestTai: 0, netPoints: 0 };
}

/**
 * Published stats with any missing fields filled in. Profiles saved before taiWins existed have
 * only tai wins (Riichi came later), so their wins are all tai wins.
 */
export function normaliseStats(raw: Partial<PlayerStats> | undefined): PlayerStats {
  const stats = { ...emptyStats(), ...raw };
  if (raw && raw.taiWins === undefined) stats.taiWins = stats.wins;
  return stats;
}

/** Average tai per tai-game win. */
export function averageTai(s: PlayerStats): number {
  return s.taiWins ? s.totalTai / s.taiWins : 0;
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
  /** Permanent titles: earned at some point in the games that still exist. */
  earnedTitles?: string[];
  /** Titles only the admin can give, such as Founding Member. Only an admin can write this. */
  grantedTitles?: string[];
  /** Group titles this player holds right now. */
  heldTitles?: HeldTitle[];
  /** Title keys (see titleKey) the player chose to show publicly, best first. */
  displayedTitles?: string[];
  /** Public profile design (see game/profileThemes.ts). Everyone who visits sees it. */
  profileTheme?: string;
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

/** An immediate payout (a kong, a flower kong...) recorded during a hand. */
export interface PayoutRecord {
  id: string;
  /** ImmediatePayoutDef id. */
  type: string;
  receiverId: string;
  /** Only for discarder-pays payouts. */
  payerId: string | null;
  /** The hand it happened in. */
  handNumber: number;
  payments: Record<string, number>;
  createdBy: string;
  /** Milliseconds. Firestore can't put server timestamps inside arrays. */
  at: number;
}

export interface Session {
  id: string;
  groupId: string;
  memberIds: string[];
  players: Player[]; // fixed seat order, index 0 starts as East
  rulesetId: string;
  rulesetName: string;
  /** House rules chosen when the game started. Games from before these existed have none. */
  options?: GameOptions;
  table: TableState;
  scores: Record<string, number>;
  /** Immediate payouts so far. Already included in `scores`. */
  payouts?: PayoutRecord[];
  status: 'active' | 'finished';
  createdBy: string;
  /** When the game started. The playing-time clock runs from here. */
  createdAt?: { toMillis(): number } | null;
  /** When the game ended. Games that ended before this was recorded have none. */
  finishedAt?: { toMillis(): number } | null;
}

export type HandResult = 'win' | 'draw' | 'falseWin';

/** What a Riichi hand recorded, beyond the shared fields. */
export interface RiichiHandData {
  declarers: string[];
  /** Every winner (two for a double ron). The shared winnerId is the one who took the sticks. */
  winners: (RiichiWinner & { base: number })[];
  drawType: 'exhaustive' | 'abortive' | null;
  tenpai: string[];
  nagashiId: string | null;
  /** At the start of the hand. */
  honba: number;
  sticksBefore: number;
  sticksAfter: number;
  outcome: RiichiOutcome;
}

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
  /** Who declared the false win (or chombo). Only set when result is falseWin. */
  offenderId?: string | null;
  /** Riichi games only. */
  riichi?: RiichiHandData;
  patterns: ClaimedPattern[];
  /** The winning tiles, when the hand was recorded with the tile calculator. */
  tiles?: string[];
  flowers?: string[];
  tai: number;
  payout: number;
  payments: Record<string, number>;
  createdBy: string;
  createdAt?: { toMillis(): number } | null;
}

/** An invitation to join a group, waiting in the invited player's inbox. */
export interface GroupInvite {
  /** `${groupId}_${toUid}`: one invitation per group per player. */
  id: string;
  groupId: string;
  groupName: string;
  fromUid: string;
  fromName: string;
  fromAvatar: string;
  toUid: string;
  createdAt?: { toMillis(): number } | null;
}

/** A winning hand shared to the Hub. A snapshot, so it stays even if the game is deleted. */
export interface HubPost {
  /** `${authorUid}_${sessionId}`: one post per player per game. */
  id: string;
  authorUid: string;
  authorName: string;
  authorAvatar: string;
  sessionId: string;
  handNumber: number;
  rulesetId: string;
  tai: number;
  winType: WinType;
  /** Who dealt in, for wins off a discard. */
  discarderName: string | null;
  patterns: ClaimedPattern[];
  /** Tile codes (see game/tiles.ts), in the order the player laid them out. */
  tiles: string[];
  flowers: string[];
  caption: string;
  likedBy: string[];
  commentCount: number;
  createdAt?: { toMillis(): number } | null;
}

export interface HubComment {
  id: string;
  authorUid: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  createdAt?: { toMillis(): number } | null;
}
