import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './auth';
import {
  fetchHands,
  saveGameResult,
  subscribeAllResults,
  subscribeHands,
  subscribeIsAdmin,
  subscribeLikedCount,
  subscribeMyGroups,
  subscribeMySessions,
  subscribeResultsFor,
  updateProfile,
} from './db';
import type { UnlockCounts } from './game/profileThemes';
import { bestStats, GameResult, gameResult, RESULTS_VERSION, sumResults } from './game/results';
import { computeStats } from './game/stats';
import { earnedTitles, findTitle, HeldTitle, PlayerCounts, playerCounts, Progress, titleKey, titleProgress } from './game/titles';
import type { Group, HandRecord, PlayerStats, Session, UserProfile } from './types';

export interface PlayerRecord {
  stats: PlayerStats;
  titles: { permanent: string[]; held: HeldTitle[] };
  /** How close each title is. */
  progress: Record<string, Progress>;
  /** Games played and won, and limit hands won, for unlocking profile designs. */
  counts: PlayerCounts;
}

/**
 * Career stats and titles, worked out live from every game the player can see. Nothing here is
 * stored, so deleting a game takes it out straight away. Null until everything has loaded.
 */
export function usePlayerRecord(uid: string): { record: PlayerRecord | null; error: string | null } {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [hands, setHands] = useState<Record<string, HandRecord[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeMySessions(uid, setSessions, (e) => setError(e.message)), [uid]);
  useEffect(() => subscribeMyGroups(uid, setGroups, (e) => setError(e.message)), [uid]);

  // One listener per game, so new hands and deleted games show up straight away. Group titles
  // compare everyone in the group, so this includes games the player wasn't seated in.
  const ids = (sessions ?? []).map((s) => s.id);
  const key = ids.join(',');
  useEffect(() => {
    setHands((prev) => Object.fromEntries(ids.filter((id) => prev[id]).map((id) => [id, prev[id]])));
    const unsubs = ids.map((id) =>
      subscribeHands(
        id,
        (h) => setHands((prev) => ({ ...prev, [id]: h })),
        // e.g. a game deleted while we're listening. Count it as empty rather than waiting forever;
        // the sessions listener drops it from the list anyway.
        () => setHands((prev) => ({ ...prev, [id]: [] })),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [key]);

  const loaded = sessions !== null && groups !== null && ids.every((id) => hands[id]);
  const record = useMemo(
    () =>
      loaded
        ? {
            stats: computeStats(uid, sessions, hands),
            titles: earnedTitles(uid, sessions, hands, groups),
            progress: titleProgress(uid, sessions, hands, groups),
            counts: playerCounts(uid, sessions, hands),
          }
        : null,
    [loaded, uid, sessions, hands, groups],
  );
  return { record, error };
}

// Firestore doesn't keep the key order of maps, so compare with keys sorted.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical((value as Record<string, unknown>)[k])]));
  }
  return value;
}
const sameJson = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/**
 * Copies this player's stats and titles onto their profile, so the leaderboard and other players
 * can see them without reading this player's games. Only writes when something changed; other
 * players' copies refresh when they next open the app.
 */
export function usePublishRecord(profile: UserProfile | null, record: PlayerRecord | null, registered: boolean) {
  useEffect(() => {
    if (!profile || !record) return;
    // Worked out from the games that still exist, so deleting a game takes away titles only it
    // earned. Grant-only titles never go in here; the Firestore rules would reject the update.
    const earnedTitles = record.titles.permanent.filter((id) => !findTitle(id)?.grantOnly).sort();
    const heldTitles = [...record.titles.held].sort((a, b) =>
      titleKey(a.id, a.groupId).localeCompare(titleKey(b.id, b.groupId)),
    );
    const next = { stats: record.stats, registered, earnedTitles, heldTitles };
    const current = {
      stats: profile.stats,
      registered: profile.registered,
      earnedTitles: profile.earnedTitles ?? [],
      heldTitles: profile.heldTitles ?? [],
    };
    if (sameJson(next, current)) return;
    updateProfile(profile.uid, next).catch((e) =>
      // Not worth interrupting the player for; it's tried again the next time this screen updates.
      console.warn('Could not publish stats and titles:', (e as Error).message),
    );
  }, [profile, record, registered]);
}

/**
 * Saves each finished game's results the moment it ends, so the leaderboard updates for everyone
 * at the table, not only for players who open their profile. Runs on every phone in the game;
 * whichever gets there first writes it, and the rest find it saved. Also fills in games that
 * finished before results were saved.
 */
export function GameResultsKeeper() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [saved, setSaved] = useState<Record<string, number> | null>(null);
  const tried = useRef(new Set<string>());

  useEffect(() => (uid ? subscribeMySessions(uid, setSessions, () => setSessions(null)) : undefined), [uid]);
  useEffect(
    () =>
      uid
        ? subscribeResultsFor(uid, (r) => setSaved(Object.fromEntries(r.map((x) => [x.id, x.version ?? 0]))), () => setSaved(null))
        : undefined,
    [uid],
  );

  useEffect(() => {
    if (!uid || !sessions || !saved) return;
    for (const s of sessions) {
      const seated = s.players.some((p) => p.uid === uid);
      if (s.status !== 'finished' || !seated || (saved[s.id] ?? -1) >= RESULTS_VERSION) continue;
      // Once per game per app run, so a refused write (e.g. rules not published yet) isn't retried in a loop.
      const key = `${s.id}:${RESULTS_VERSION}`;
      if (tried.current.has(key)) continue;
      tried.current.add(key);
      fetchHands(s.id)
        .then((hands) => saveGameResult(gameResult(s, hands)))
        .catch((e) => console.warn(`Could not save results for game ${s.id}:`, (e as Error).message));
    }
  }, [uid, sessions, saved]);

  return null;
}

/** Every account's stats added up from finished games, live. Null until loaded. */
export function useResultTotals(uid?: string): { totals: Record<string, PlayerStats> | null; error: string | null } {
  const [results, setResults] = useState<GameResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () => (uid ? subscribeResultsFor(uid, setResults, (e) => setError(e.message)) : subscribeAllResults(setResults, (e) => setError(e.message))),
    [uid],
  );
  const totals = useMemo(() => (results ? sumResults(results) : null), [results]);
  return { totals, error };
}

/** A profile with its stats taken from finished games where they're more complete. */
export function withResultStats(profile: UserProfile, totals: Record<string, PlayerStats> | null): UserProfile {
  return { ...profile, stats: bestStats(profile.stats, totals?.[profile.uid]) };
}

/** Everything profile designs unlock with, plus whether this player is an admin (who has them all). */
export function useUnlocks(uid: string): { counts: UnlockCounts | null; isAdmin: boolean; record: PlayerRecord | null } {
  const { record } = usePlayerRecord(uid);
  const [likesGiven, setLikesGiven] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => subscribeLikedCount(uid, setLikesGiven, () => setLikesGiven(0)), [uid]);
  useEffect(() => subscribeIsAdmin(uid, setIsAdmin), [uid]);
  const counts = record && likesGiven !== null ? { ...record.counts, likesGiven } : null;
  return { counts, isAdmin, record };
}
