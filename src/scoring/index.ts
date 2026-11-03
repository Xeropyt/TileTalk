import { houseRules } from './rulesets/houseRules';
import type { Ruleset } from './types';

// Add new rulesets (Hong Kong, Singapore, Riichi, Taiwanese, MCR...) to this list.
export const RULESETS: Ruleset[] = [houseRules];

export function getRuleset(id: string): Ruleset {
  return RULESETS.find((r) => r.id === id) ?? houseRules;
}

export const PATTERN_GROUP_NAMES: Record<string, string> = {
  bonus: 'Flowers',
  sets: 'Sets',
  shape: 'Hand shape',
  winning: 'How you won',
  limit: 'Limit hands',
};

export * from './engine';
export * from './types';
