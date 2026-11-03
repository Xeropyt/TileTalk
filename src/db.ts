import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { initialTable, nextTableState } from './game/winds';
import { getRuleset } from './scoring';
import type { ClaimedPattern, WinType } from './scoring/types';
import type { Group, GroupMember, HandRecord, HandResult, Player, Session, UserProfile } from './types';

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

export async function createSession(group: Group, players: Player[], rulesetId: string, uid: string): Promise<string> {
  if (players.length !== 4) throw new Error('A game needs exactly four players.');
  const ruleset = getRuleset(rulesetId);
  const ref = doc(collection(db, 'sessions'));
  const batch = writeBatch(db);
  batch.set(ref, {
    groupId: group.id,
    memberIds: group.memberIds,
    players,
    rulesetId: ruleset.id,
    rulesetName: ruleset.name,
    table: initialTable(),
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
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

// ---------- Recording a hand ----------

export interface HandInput {
  result: HandResult;
  winType: WinType | null;
  winnerId: string | null;
  discarderId: string | null;
  offenderId: string | null;
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
  const ruleset = getRuleset(session.rulesetId);

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
    const next = nextTableState(
      current.table,
      { dealerWon: input.winnerId === dealer.id, draw: input.result === 'draw', replay: input.result === 'falseWin' },
      ruleset.rotation,
    );

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
