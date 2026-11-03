import { handValue } from '../scoring/riichi';
import type { HandRecord, Session } from '../types';

/** The player's most recent finished game they were seated in. Sessions come newest first. */
export function lastFinishedGame(uid: string, sessions: Session[]): Session | null {
  return sessions.find((s) => s.status === 'finished' && s.players.some((p) => p.uid === uid)) ?? null;
}

/**
 * The player's highest-scoring win in a game. On a tie, the more recent hand. In a Riichi double
 * ron both winners count, so the hand comes back with `tai` set to this player's own value.
 */
export function bestWin(uid: string, session: Session, hands: HandRecord[]): HandRecord | null {
  const me = session.players.find((p) => p.uid === uid);
  if (!me) return null;
  const wins = hands.flatMap((h): HandRecord[] => {
    if (h.result !== 'win') return [];
    const mine = h.riichi?.winners.find((w) => w.playerId === me.id);
    if (mine) return [{ ...h, tai: handValue(mine.han, mine.yakuman) }];
    return h.winnerId === me.id ? [h] : [];
  });
  return wins.reduce<HandRecord | null>(
    (best, h) => (!best || h.tai > best.tai || (h.tai === best.tai && h.handNumber > best.handNumber) ? h : best),
    null,
  );
}
