import { emptyStats, HandRecord, PlayerStats, Session } from '../types';

/**
 * Career stats for one account, worked out from the games that still exist. Nothing is stored,
 * so deleting a game takes its hands out of everyone's stats automatically.
 */
export function computeStats(uid: string, sessions: Session[], handsBySession: Record<string, HandRecord[]>): PlayerStats {
  const s = emptyStats();
  for (const session of sessions) {
    const me = session.players.find((p) => p.uid === uid);
    if (!me) continue; // in the group, but not seated in this game
    for (const h of handsBySession[session.id] ?? []) {
      s.netPoints += h.payments?.[me.id] ?? 0;
      // A false win is a penalty, not a hand: the hand is replayed, and the replay is what counts.
      if (h.result === 'falseWin') continue;
      s.handsPlayed += 1;
      if (h.winnerId === me.id) {
        s.wins += 1;
        s.totalTai += h.tai;
        s.biggestTai = Math.max(s.biggestTai, h.tai);
        if (h.winType === 'selfDraw') s.selfDraws += 1;
      }
      if (h.discarderId === me.id) s.dealIns += 1;
    }
  }
  return s;
}
