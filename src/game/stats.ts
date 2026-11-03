import { getRuleset } from '../scoring';
import { emptyStats, HandRecord, PlayerStats, Session } from '../types';

/**
 * Career stats for one account, worked out from the games that still exist. Nothing is stored,
 * so deleting a game takes its hands out of everyone's stats automatically.
 *
 * Points and tai only come from tai games: Riichi points are in the thousands and han aren't
 * tai, so mixing them in would swamp the numbers. Riichi hands still count as hands and wins.
 */
export function computeStats(uid: string, sessions: Session[], handsBySession: Record<string, HandRecord[]>): PlayerStats {
  const s = emptyStats();
  for (const session of sessions) {
    const me = session.players.find((p) => p.uid === uid);
    if (!me) continue; // in the group, but not seated in this game
    const tai = getRuleset(session.rulesetId).scoringModel === 'tai';
    if (tai) for (const p of session.payouts ?? []) s.netPoints += p.payments?.[me.id] ?? 0;
    for (const h of handsBySession[session.id] ?? []) {
      if (tai) s.netPoints += h.payments?.[me.id] ?? 0;
      // A false win is a penalty, not a hand: the hand is replayed, and the replay is what counts.
      if (h.result === 'falseWin') continue;
      s.handsPlayed += 1;
      // A double ron has two winners.
      const winners = h.riichi?.winners.length ? h.riichi.winners.map((w) => w.playerId) : [h.winnerId];
      if (winners.includes(me.id)) {
        s.wins += 1;
        if (h.winType === 'selfDraw') s.selfDraws += 1;
        if (tai) {
          s.taiWins += 1;
          s.totalTai += h.tai;
          s.biggestTai = Math.max(s.biggestTai, h.tai);
        }
      }
      if (h.discarderId === me.id) s.dealIns += 1;
    }
  }
  return s;
}
