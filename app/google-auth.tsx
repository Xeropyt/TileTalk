import { useEffect } from 'react';
import { router } from 'expo-router';
import { Loading } from '../src/ui';

/**
 * Where Google sign-in hands back to the app (see src/auth.tsx). The sign-in screen reads the
 * result itself; on Android the link also opens this route, so it just steps back out of the way.
 */
export default function GoogleAuthReturn() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/?tab=profile');
  }, []);
  return <Loading />;
}
