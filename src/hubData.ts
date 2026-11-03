import { useEffect, useState } from 'react';
import { subscribeHands, subscribeMySessions } from './db';
import { bestWin, lastFinishedGame } from './game/hub';
import type { HandRecord, Session } from './types';

/** The player's best winning hand from their last finished game, live. */
export function useLastBestWin(uid: string): { loading: boolean; game: Session | null; hand: HandRecord | null } {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [hands, setHands] = useState<HandRecord[] | null>(null);

  useEffect(() => subscribeMySessions(uid, setSessions, () => setSessions([])), [uid]);
  const game = sessions ? lastFinishedGame(uid, sessions) : null;
  const gameId = game?.id;
  useEffect(() => {
    setHands(null);
    if (!gameId) return;
    return subscribeHands(gameId, setHands, () => setHands([]));
  }, [gameId]);

  return {
    loading: sessions === null || (!!game && hands === null),
    game,
    hand: game && hands ? bestWin(uid, game, hands) : null,
  };
}
