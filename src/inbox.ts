import { useEffect, useState } from 'react';
import { useAuth } from './auth';
import { subscribeInbox } from './db';
import type { GroupInvite } from './types';

/** Invitations waiting for the signed-in player. Empty while loading or signed out. */
export function useInbox(): { invites: GroupInvite[]; error: string | null } {
  const { user } = useAuth();
  const uid = user?.uid;
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setInvites([]);
    return uid ? subscribeInbox(uid, setInvites, (e) => setError(e.message)) : undefined;
  }, [uid]);
  return { invites, error };
}
