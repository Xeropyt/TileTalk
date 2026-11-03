import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RULESETS } from './scoring';

const RULESET_KEY = 'tiletalk.rulesetId';

// Shared in memory so the Rules page and the new-game screen stay in step.
let preferredRuleset = RULESETS[0].id;
const listeners = new Set<(id: string) => void>();

AsyncStorage.getItem(RULESET_KEY)
  .then((saved) => {
    if (saved && RULESETS.some((r) => r.id === saved)) setPreferredRuleset(saved, false);
  })
  .catch(() => {
    // Storage can be unavailable (e.g. private browsing). The default ruleset still works.
  });

function setPreferredRuleset(id: string, save = true) {
  preferredRuleset = id;
  listeners.forEach((l) => l(id));
  if (save) AsyncStorage.setItem(RULESET_KEY, id).catch(() => {});
}

/** The rules this person usually plays. New games start with them. */
export function usePreferredRuleset(): [string, (id: string) => void] {
  const [id, setId] = useState(preferredRuleset);
  useEffect(() => {
    listeners.add(setId);
    setId(preferredRuleset);
    return () => {
      listeners.delete(setId);
    };
  }, []);
  return [id, setPreferredRuleset];
}
