import {
  arrayRemove,
  arrayUnion,
  collection,
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
import { initialTable, nextTableState, TableState } from './game/winds';
import { getRuleset, nextRiichiTable, riichiOptionsOf, rulesetFor } from './scoring';
import type { ClaimedPattern, GameOptions, WinType } from './scoring/types';
import type {
  Group,
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
  changes: Partial<Pick<UserProfile, 'displayName' | 'avatar' | 'stats' | 'registered' | 'earnedTitles' | 'heldTitles' | 'displayedTitles'>>,
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
    (snap) => onData(snap.exists() ? ({ id: snap.id, ...snap.data() } as Session) : null),
    onError,
  );
}

export function subscribeHands(sessionId: string, onData: (h: HandRecord[]) => void, onError: OnError): Unsubscribe {
  const q = query(collection(db, 'sessions', sessionId, 'hands'), orderBy('handNumber', 'desc'));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HandRecord)), onError);
}

export async function endSession(sessionId: string) {
  await updateDoc(doc(db, 'sessions', sessionId), { status: 'finished', 'table.finished': true });
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
    if (i + 499 >= hands.length) batch.delete(sessionRef);
    await batch.commit();
  }
}

// ---------- Immediate payouts ----------

/** Records an immediate payout and adds it to the running scores in one go. */
export async function recordPayout(
  session: Session,
  input: { type: string; receiverId: string; payerId: string | null; payments: Record<string, number> },
  createdBy: string,
): Promise<void> {
  const sessionRef = doc(db, 'sessions', session.id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists()) throw new Error('This game no longer exists.');
    const current = { id: snap.id, ...snap.data() } as Session;
    if (current.status !== 'active') throw new Error('This game has already finished.');
    const record: PayoutRecord = {
      id: Math.random().toString(36).slice(2, 12),
      ...input,
      handNumber: current.table.handNumber,
      createdBy,
      at: Date.now(),
    };
    const update: Record<string, unknown> = { payouts: [...(current.payouts ?? []), record] };
    for (const [pid, delta] of Object.entries(input.payments)) {
      if (delta !== 0) update[`scores.${pid}`] = increment(delta);
    }
    tx.update(sessionRef, update);
  });
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
  tai: number;
  payout: number;
  payments: Record<string, number>;
}

/**
 * Saves a hand, moves the dealer and round wind on and updates the running scores, all in
 * one transaction, so the hand and the scores can't drift apart. Career stats aren't stored;
 * they're worked out from the saved hands (see stats.ts).
 */
export async function recordHand(session: Session, input: HandInput, createdBy: string): Promise<void> {
  const sessionRef = doc(db, 'sessions', session.id);
  const handRef = doc(collection(sessionRef, 'hands'));
  const ruleset = rulesetFor(session.rulesetId, session.options);

  await runTransaction(db, async (tx) => {
    // All reads must come before any writes in a transaction.
    const snap = await tx.get(sessionRef);
    if (!snap.exists()) throw new Error('This game no longer exists.');
    const current = { id: snap.id, ...snap.data() } as Session;
    if (current.status !== 'active') throw new Error('This game has already finished.');
    if (current.table.handNumber !== session.table.handNumber) {
      throw new Error('Someone else just recorded this hand. Check the history before adding it again.');
    }

    const dealer = current.players[current.table.dealerIndex];
    let next: TableState;
    if (ruleset.scoringModel === 'hanFu') {
      if (!input.riichi) throw new Error('Missing the Riichi details for this hand.');
      const opts = riichiOptionsOf(ruleset, current.options, current.players.length);
      next = nextRiichiTable(current.table, input.riichi.outcome, opts, current.players.length, input.riichi.sticksAfter);
      // Busting: anyone below zero ends the game.
      const busted = current.players.some((p) => (current.scores[p.id] ?? 0) + (input.payments[p.id] ?? 0) < 0);
      if (opts.busting && busted) next = { ...next, finished: true };
    } else {
      next = nextTableState(
        current.table,
        { dealerWon: input.winnerId === dealer.id, draw: input.result === 'draw', replay: input.result === 'falseWin' },
        ruleset.rotation,
        current.players.length,
      );
    }

    tx.set(handRef, {
      handNumber: current.table.handNumber,
      prevailingWind: current.table.prevailingWind,
      dealerId: dealer.id,
      ...input,
      createdBy,
      createdAt: serverTimestamp(),
    });

    const sessionUpdate: Record<string, unknown> = {
      table: next,
      status: next.finished ? 'finished' : 'active',
    };
    for (const [playerId, delta] of Object.entries(input.payments)) {
      if (delta !== 0) sessionUpdate[`scores.${playerId}`] = increment(delta);
    }
    tx.update(sessionRef, sessionUpdate);

  });
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
