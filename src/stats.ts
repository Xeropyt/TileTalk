import { useEffect, useMemo, useState } from 'react';
import { subscribeHands, subscribeMyGroups, subscribeMySessions, updateProfile } from './db';
import { computeStats } from './game/stats';
import { earnedTitles, findTitle, HeldTitle, titleKey } from './game/titles';
import type { Group, HandRecord, PlayerStats, Session, UserProfile } from './types';

export interface PlayerRecord {
  stats: PlayerStats;
  titles: { permanent: string[]; held: HeldTitle[] };
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
        ? { stats: computeStats(uid, sessions, hands), titles: earnedTitles(uid, sessions, hands, groups) }
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
