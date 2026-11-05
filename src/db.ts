import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { GameResult } from './game/results';
import { initialTable, nextTableState, TableState } from './game/winds';
import { getRuleset, nextRiichiTable, riichiOptionsOf, rulesetFor } from './scoring';
import type { ClaimedPattern, GameOptions, WinType } from './scoring/types';
import type {
  Group,
  GroupInvite,
  GroupMember,
  HandRecord,
  HandResult,
  HubComment,
  HubPost,
  PayoutRecord,
  Player,
  RiichiHandData,
  Session,
  UserProfile,
} from './types';

type Unsubscribe = () => void;
type OnError = (e: Error) => void;

// No 0/O or 1/I, so codes are easy to read out at the table.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

// ---------- Profiles ----------

export async function updateProfile(
  uid: string,
  changes: Partial<
    Pick<UserProfile, 'displayName' | 'avatar' | 'stats' | 'registered' | 'earnedTitles' | 'heldTitles' | 'displayedTitles' | 'profileTheme'>
  >,
) {
  await updateDoc(doc(db, 'users', uid), changes);
}

export function subscribeProfile(uid: string, onData: (p: UserProfile | null) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => onData(snap.exists() ? ({ uid: snap.id, ...snap.data() } as UserProfile) : null),
    onError,
  );
}

// ---------- Admin ----------

/**
 * Admins are listed in the `admins` collection, one document per admin with their uid as the
 * id. Add them by hand in the Firebase console; the app can't write there.
 */
export function subscribeIsAdmin(uid: string, onData: (isAdmin: boolean) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'admins', uid),
    (snap) => onData(snap.exists()),
    () => onData(false),
  );
}

/** Admin only: every group, for moderation. */
export function subscribeAllGroups(onData: (g: Group[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    collection(db, 'groups'),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Group).sort((a, b) => a.name.localeCompare(b.name))),
    onError,
  );
}

/**
 * Admin only: deletes a group and its invite code. Its games are kept, so nobody loses their
 * history, career stats or titles; delete games one by one if they should go too.
 */
export async function deleteGroup(group: Group) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'invites', group.inviteCode));
  batch.delete(doc(db, 'groups', group.id));
  await batch.commit();
}

/** Admin only: give or take back a grant-only title, such as Founding Member. */
export async function setGrantedTitle(uid: string, titleId: string, granted: boolean) {
  await updateDoc(doc(db, 'users', uid), { grantedTitles: granted ? arrayUnion(titleId) : arrayRemove(titleId) });
}

/** Every player with an account, for the leaderboard. */
export function subscribeLeaderboard(onData: (p: UserProfile[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'users'), where('registered', '==', true)),
    (snap) => onData(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as UserProfile)),
    onError,
  );
}

// ---------- Groups ----------

export async function createGroup(name: string, uid: string, me: GroupMember): Promise<string> {
  const groupRef = doc(collection(db, 'groups'));
  const inviteCode = makeInviteCode();
  const batch = writeBatch(db);
  batch.set(groupRef, {
    name: name.trim(),
    ownerId: uid,
    memberIds: [uid],
    members: { [uid]: me },
    inviteCode,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'invites', inviteCode), { groupId: groupRef.id, createdAt: serverTimestamp() });
  await batch.commit();
  return groupRef.id;
}

export async function joinGroup(code: string, uid: string, me: GroupMember): Promise<string> {
  const clean = code.trim().toUpperCase();
  const invite = await getDoc(doc(db, 'invites', clean));
  if (!invite.exists()) throw new Error('No group uses that code. Check it with whoever shared it.');
  const groupId = invite.data().groupId as string;
  await updateDoc(doc(db, 'groups', groupId), {
    memberIds: arrayUnion(uid),
    [`members.${uid}`]: me,
  });
  return groupId;
}

export function subscribeMyGroups(uid: string, onData: (g: Group[]) => void, onError: OnError): Unsubscribe {
  const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Group).sort((a, b) => a.name.localeCompare(b.name))),
    onError,
  );
}

export function subscribeGroup(groupId: string, onData: (g: Group | null) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    doc(db, 'groups', groupId),
    (snap) => onData(snap.exists() ? ({ id: snap.id, ...snap.data() } as Group) : null),
    onError,
  );
}

// ---------- Sessions ----------

export async function createSession(
  group: Group,
  players: Player[],
  rulesetId: string,
  options: GameOptions,
  uid: string,
): Promise<string> {
  if (players.length !== options.players) throw new Error(`This game needs exactly ${options.players} players.`);
  const ruleset = getRuleset(rulesetId);
  const riichi = ruleset.scoringModel === 'hanFu' ? riichiOptionsOf(ruleset, options, players.length) : null;
  const ref = doc(collection(db, 'sessions'));
  const batch = writeBatch(db);
  batch.set(ref, {
    groupId: group.id,
    memberIds: group.memberIds,
    players,
    rulesetId: ruleset.id,
    rulesetName: ruleset.name,
    options,
    table: riichi ? { ...initialTable(), honba: 0, riichiSticks: 0 } : initialTable(),
    // Riichi players start with points; house games start at zero.
    scores: Object.fromEntries(players.map((p) => [p.id, riichi?.startingPoints ?? 0])),
    status: 'active',
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}

export function subscribeGroupSessions(
  groupId: string,
  uid: string,
  onData: (s: Session[]) => void,
  onError: OnError,
): Unsubscribe {
  // Both filters are needed: the security rules only let people read sessions they're a member of.
  const q = query(
    collection(db, 'sessions'),
    where('groupId', '==', groupId),
    where('memberIds', 'array-contains', uid),
  );
  return onSnapshot(
    q,
    (snap) => {
      const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Session);
      sessions.sort((a, b) => (b.createdAt?.toMillis() ?? Date.now()) - (a.createdAt?.toMillis() ?? Date.now()));
      onData(sessions);
    },
    onError,
  );
}

/** Every game the user is in, across all their groups, newest first. */
export function subscribeMySessions(uid: string, onData: (s: Session[]) => void, onError: OnError): Unsubscribe {
  const q = query(collection(db, 'sessions'), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Session);
      sessions.sort((a, b) => (b.createdAt?.toMillis() ?? Date.now()) - (a.createdAt?.toMillis() ?? Date.now()));
      onData(sessions);
    },
    onError,
  );
}

export function subscribeSession(id: string, onData: (s: Session | null) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    doc(db, 'sessions', id),
    // Estimate server times that haven't come back yet, so a new game's timer starts straight away.
    (snap) => onData(snap.exists() ? ({ id: snap.id, ...snap.data({ serverTimestamps: 'estimate' }) } as Session) : null),
    onError,
  );
}

export function subscribeHands(sessionId: string, onData: (h: HandRecord[]) => void, onError: OnError): Unsubscribe {
  const q = query(collection(db, 'sessions', sessionId, 'hands'), orderBy('handNumber', 'desc'));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HandRecord)), onError);
}

export async function endSession(sessionId: string) {
  await updateDoc(doc(db, 'sessions', sessionId), { status: 'finished', 'table.finished': true, finishedAt: serverTimestamp() });
}

/** Deletes a game and all its hands. Career stats come from the hands, so they update on their own. */
export async function deleteSession(sessionId: string) {
  const sessionRef = doc(db, 'sessions', sessionId);
  const hands = (await getDocs(collection(sessionRef, 'hands'))).docs;
  // A batch holds 500 writes. The game itself goes in the last batch, so if a batch fails
  // the game is still there and deleting it again finishes the job.
  for (let i = 0; i === 0 || i < hands.length; i += 499) {
    const batch = writeBatch(db);
    hands.slice(i, i + 499).forEach((h) => batch.delete(h.ref));
    if (i + 499 >= hands.length) {
      // Its results go too, so the leaderboard drops the game straight away.
      batch.delete(doc(db, 'results', sessionId));
      batch.delete(sessionRef);
    }
    await batch.commit();
  }
}

/** A game's hands, read once. */
export async function fetchHands(sessionId: string): Promise<HandRecord[]> {
  const snap = await getDocs(collection(db, 'sessions', sessionId, 'hands'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HandRecord);
}

// ---------- Game results (what the leaderboard adds up) ----------

export async function saveGameResult(result: GameResult) {
  await setDoc(doc(db, 'results', result.id), result);
}

/** Every finished game's results, for the leaderboard. */
export function subscribeAllResults(onData: (r: GameResult[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    collection(db, 'results'),
    (snap) => onData(snap.docs.map((d) => ({ ...(d.data() as GameResult), id: d.id }))),
    onError,
  );
}

/** One player's game results, for their public profile. */
export function subscribeResultsFor(uid: string, onData: (r: GameResult[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'results'), where('uids', 'array-contains', uid)),
    (snap) => onData(snap.docs.map((d) => ({ ...(d.data() as GameResult), id: d.id }))),
    onError,
  );
}

// ---------- Group invitations ----------

export function inviteIdFor(groupId: string, toUid: string): string {
  return `${groupId}_${toUid}`;
}

/** Puts an invitation in the player's inbox. One per group per player. */
export async function sendGroupInvite(group: Group, toUid: string, from: { uid: string; name: string; avatar: string }) {
  const id = inviteIdFor(group.id, toUid);
  try {
    await setDoc(doc(db, 'groupInvites', id), {
      groupId: group.id,
      groupName: group.name,
      fromUid: from.uid,
      fromName: from.name,
      fromAvatar: from.avatar,
      toUid,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    // The rules only allow creating, so an invitation that's already waiting is refused.
    if ((e as { code?: string }).code === 'permission-denied') throw new Error('They already have an invitation to this group.');
    throw e;
  }
}

/** Invitations waiting for this player, newest first. */
export function subscribeInbox(uid: string, onData: (i: GroupInvite[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'groupInvites'), where('toUid', '==', uid)),
    (snap) => {
      const invites = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GroupInvite);
      invites.sort((a, b) => (b.createdAt?.toMillis() ?? Date.now()) - (a.createdAt?.toMillis() ?? Date.now()));
      onData(invites);
    },
    onError,
  );
}

/** Invitations this player has sent for one group that haven't been answered yet. */
export function subscribeSentInvites(uid: string, groupId: string, onData: (i: GroupInvite[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'groupInvites'), where('fromUid', '==', uid), where('groupId', '==', groupId)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GroupInvite)),
    onError,
  );
}

/** Joins the group, then clears the invitation. */
export async function acceptGroupInvite(invite: GroupInvite, uid: string, me: GroupMember) {
  try {
    await updateDoc(doc(db, 'groups', invite.groupId), { memberIds: arrayUnion(uid), [`members.${uid}`]: me });
  } catch (e) {
    if ((e as { code?: string }).code === 'not-found') {
      await deleteDoc(doc(db, 'groupInvites', invite.id));
      throw new Error('That group doesn’t exist any more.');
    }
    throw e;
  }
  await deleteDoc(doc(db, 'groupInvites', invite.id));
}

/** Declining, or the sender taking it back. */
export async function deleteGroupInvite(inviteId: string) {
  await deleteDoc(doc(db, 'groupInvites', inviteId));
}

// ---------- Profiles, read once ----------

const profileCache = new Map<string, UserProfile | null>();

/** Several players' profiles, e.g. who liked a post. Kept for the rest of the session. */
export async function fetchProfiles(uids: string[]): Promise<UserProfile[]> {
  const missing = uids.filter((u) => !profileCache.has(u));
  await Promise.all(
    missing.map(async (u) => {
      const snap = await getDoc(doc(db, 'users', u));
      profileCache.set(u, snap.exists() ? ({ uid: snap.id, ...snap.data() } as UserProfile) : null);
    }),
  );
  return uids.map((u) => profileCache.get(u)).filter((p): p is UserProfile => !!p);
}

// ---------- Immediate payouts ----------

/**
 * Records an immediate payout and adds it to the running scores in one write. Not a transaction,
 * so it shows on this phone straight away instead of after a round trip to the server.
 */
export async function recordPayout(
  session: Session,
  input: { type: string; receiverId: string; payerId: string | null; payments: Record<string, number> },
  createdBy: string,
): Promise<void> {
  if (session.status !== 'active') throw new Error('This game has already finished.');
  const record: PayoutRecord = {
    id: Math.random().toString(36).slice(2, 12),
    ...input,
    handNumber: session.table.handNumber,
    createdBy,
    at: Date.now(),
  };
  const update: Record<string, unknown> = { payouts: arrayUnion(record) };
  for (const [pid, delta] of Object.entries(input.payments)) {
    if (delta !== 0) update[`scores.${pid}`] = increment(delta);
  }
  await updateDoc(doc(db, 'sessions', session.id), update);
}

/** Takes a payout back out, scores included. Safe if two people undo it at once. */
export async function undoPayout(sessionId: string, payoutId: string): Promise<void> {
  const sessionRef = doc(db, 'sessions', sessionId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists()) throw new Error('This game no longer exists.');
    const payouts = ((snap.data() as Session).payouts ?? []) as PayoutRecord[];
    const target = payouts.find((p) => p.id === payoutId);
    if (!target) return; // already undone
    const update: Record<string, unknown> = { payouts: payouts.filter((p) => p.id !== payoutId) };
    for (const [pid, delta] of Object.entries(target.payments)) {
      if (delta !== 0) update[`scores.${pid}`] = increment(-delta);
    }
    tx.update(sessionRef, update);
  });
}

// ---------- Recording a hand ----------

export interface HandInput {
  result: HandResult;
  winType: WinType | null;
  winnerId: string | null;
  discarderId: string | null;
  offenderId: string | null;
  riichi?: RiichiHandData;
  patterns: ClaimedPattern[];
  tiles?: string[];
  flowers?: string[];
  tai: number;
  payout: number;
  payments: Record<string, number>;
}

/**
 * Saves a hand, moves the dealer and round wind on and updates the running scores in one batch,
 * so the hand and the scores can't drift apart. A batch rather than a transaction, so every phone
 * sees it without waiting on an extra round trip. Career stats aren't stored; they're worked out
 * from the saved hands (see stats.ts).
 */
export async function recordHand(session: Session, input: HandInput, createdBy: string): Promise<void> {
  if (session.status !== 'active') throw new Error('This game has already finished.');
  const sessionRef = doc(db, 'sessions', session.id);
  // One id per hand number. Hands can only be created, never overwritten (see firestore.rules), so
  // if someone else has just recorded this hand, the whole batch is refused.
  const handRef = doc(collection(sessionRef, 'hands'), `h${session.table.handNumber}`);
  const ruleset = rulesetFor(session.rulesetId, session.options);

  const dealer = session.players[session.table.dealerIndex];
  let next: TableState;
  if (ruleset.scoringModel === 'hanFu') {
    if (!input.riichi) throw new Error('Missing the Riichi details for this hand.');
    const opts = riichiOptionsOf(ruleset, session.options, session.players.length);
    next = nextRiichiTable(session.table, input.riichi.outcome, opts, session.players.length, input.riichi.sticksAfter);
    // Busting: anyone below zero ends the game.
    const busted = session.players.some((p) => (session.scores[p.id] ?? 0) + (input.payments[p.id] ?? 0) < 0);
    if (opts.busting && busted) next = { ...next, finished: true };
  } else {
    next = nextTableState(
      session.table,
      { dealerWon: input.winnerId === dealer.id, draw: input.result === 'draw', replay: input.result === 'falseWin' },
      ruleset.rotation,
      session.players.length,
    );
  }

  const batch = writeBatch(db);
  batch.set(handRef, {
    handNumber: session.table.handNumber,
    prevailingWind: session.table.prevailingWind,
    dealerId: dealer.id,
    ...input,
    createdBy,
    createdAt: serverTimestamp(),
  });
  const sessionUpdate: Record<string, unknown> = {
    table: next,
    status: next.finished ? 'finished' : 'active',
  };
  if (next.finished) sessionUpdate.finishedAt = serverTimestamp();
  for (const [playerId, delta] of Object.entries(input.payments)) {
    if (delta !== 0) sessionUpdate[`scores.${playerId}`] = increment(delta);
  }
  batch.update(sessionRef, sessionUpdate);
  try {
    await batch.commit();
  } catch (e) {
    if ((e as { code?: string }).code === 'permission-denied') {
      throw new Error('Someone else just recorded this hand. Check the history before adding it again.');
    }
    throw e;
  }
}

// ---------- Hub ----------

const FEED_SIZE = 50;

export function subscribeFeed(onData: (p: HubPost[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(FEED_SIZE)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HubPost)),
    onError,
  );
}

export function subscribePost(id: string, onData: (p: HubPost | null) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    doc(db, 'posts', id),
    (snap) => onData(snap.exists() ? ({ id: snap.id, ...snap.data() } as HubPost) : null),
    onError,
  );
}

export function postIdFor(uid: string, sessionId: string): string {
  return `${uid}_${sessionId}`;
}

/** Shares a hand. One post per player per game, so sharing the same game again is refused. */
export async function sharePost(post: Omit<HubPost, 'id' | 'likedBy' | 'commentCount' | 'createdAt'>): Promise<string> {
  const id = postIdFor(post.authorUid, post.sessionId);
  const ref = doc(db, 'posts', id);
  if ((await getDoc(ref)).exists()) throw new Error('You’ve already shared a hand from this game.');
  await setDoc(ref, { ...post, likedBy: [], commentCount: 0, createdAt: serverTimestamp() });
  return id;
}

/** How many Hub posts this player has liked, live. */
export function subscribeLikedCount(uid: string, onData: (n: number) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'posts'), where('likedBy', 'array-contains', uid)),
    (snap) => onData(snap.size),
    onError,
  );
}

export async function setLiked(postId: string, uid: string, liked: boolean) {
  await updateDoc(doc(db, 'posts', postId), { likedBy: liked ? arrayUnion(uid) : arrayRemove(uid) });
}

export function subscribeComments(postId: string, onData: (c: HubComment[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc')),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HubComment)),
    onError,
  );
}

export async function addComment(postId: string, comment: Omit<HubComment, 'id' | 'createdAt'>) {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'posts', postId, 'comments')), { ...comment, createdAt: serverTimestamp() });
  batch.update(doc(db, 'posts', postId), { commentCount: increment(1) });
  await batch.commit();
}

export async function deleteComment(postId: string, commentId: string) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'posts', postId, 'comments', commentId));
  batch.update(doc(db, 'posts', postId), { commentCount: increment(-1) });
  await batch.commit();
}

/** Deletes a post and its comments. The post goes last, so a retry can finish the job. */
export async function deletePost(postId: string) {
  const comments = (await getDocs(collection(db, 'posts', postId, 'comments'))).docs;
  for (let i = 0; i === 0 || i < comments.length; i += 499) {
    const batch = writeBatch(db);
    comments.slice(i, i + 499).forEach((c) => batch.delete(c.ref));
    if (i + 499 >= comments.length) batch.delete(doc(db, 'posts', postId));
    await batch.commit();
  }
}
