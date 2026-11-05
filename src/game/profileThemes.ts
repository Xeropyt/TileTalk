import { countProgress, PlayerCounts, Progress } from './titles';

/**
 * Public profile designs. Unlike app themes, a player's choice is saved on their profile and
 * everyone who visits it sees it. The colours are fixed per design, so the profile looks the same
 * whatever app theme the visitor uses.
 */
export interface ProfileLook {
  background: string;
  /** A second colour for the header's lower band. */
  band: string;
  border: string;
  /** Ring around the avatar. */
  frame: string;
  frameWidth: number;
  /** Behind the avatar emoji. */
  avatarBackground: string;
  name: string;
  /** Lines under the name. */
  subtitle: string;
  font: 'sans' | 'serif' | 'mono';
  /** Letter spacing for the name. */
  tracking: number;
  uppercase: boolean;
  /** Small marks in the header's corners. */
  ornament?: string;
  ornamentColor?: string;
  /** Edge colour for the titles shown on the profile. */
  accent: string;
}

export interface UnlockCounts extends PlayerCounts {
  /** Hub posts this player has liked. */
  likesGiven: number;
}

export interface ProfileThemeDef {
  id: string;
  name: string;
  description: string;
  /** What unlocks it. None: everyone has it. */
  unlock?: { stat: keyof UnlockCounts; target: number; unit: string; label: string };
  look: ProfileLook;
}

export const DEFAULT_PROFILE_THEME = 'classic';

export const PROFILE_THEMES: ProfileThemeDef[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Clean and simple. Lets your titles do the talking.',
    look: {
      background: '#1B2A26',
      band: '#22362F',
      border: '#3A5A50',
      frame: '#E9EFEC',
      frameWidth: 2,
      avatarBackground: '#27403A',
      name: '#F2F6F4',
      subtitle: '#A9BFB6',
      font: 'sans',
      tracking: 0,
      uppercase: false,
      accent: '#A9BFB6',
    },
  },
  {
    id: 'cyber',
    name: 'Cyber',
    description: 'Dark glass and neon. A modern gaming look.',
    look: {
      background: '#0A0B14',
      band: '#111327',
      border: '#00E5FF',
      frame: '#FF2BD6',
      frameWidth: 3,
      avatarBackground: '#151838',
      name: '#7CF9FF',
      subtitle: '#B9A7FF',
      font: 'mono',
      tracking: 1.5,
      uppercase: true,
      ornament: '◢',
      ornamentColor: '#00E5FF',
      accent: '#00E5FF',
    },
  },
  {
    id: 'jade',
    name: 'Jade',
    description: 'Mahjong greens with carved-jade borders.',
    unlock: { stat: 'gamesPlayed', target: 10, unit: 'games played', label: 'Play 10 games' },
    look: {
      background: '#0E4A3A',
      band: '#13604B',
      border: '#7ED3AE',
      frame: '#B8F0D4',
      frameWidth: 4,
      avatarBackground: '#0A3A2D',
      name: '#F1FBF5',
      subtitle: '#B3E3CC',
      font: 'serif',
      tracking: 0.5,
      uppercase: false,
      ornament: '❖',
      ornamentColor: '#7ED3AE',
      accent: '#7ED3AE',
    },
  },
  {
    id: 'royal',
    name: 'Royal',
    description: 'Gold trim, deep velvet and a little luxury.',
    unlock: { stat: 'gamesWon', target: 10, unit: 'games won', label: 'Win 10 games (finish first, not just hands)' },
    look: {
      background: '#1E1430',
      band: '#2A1C44',
      border: '#E2B74E',
      frame: '#F3D27A',
      frameWidth: 4,
      avatarBackground: '#2F2050',
      name: '#F7DE97',
      subtitle: '#D7C6A0',
      font: 'serif',
      tracking: 2,
      uppercase: true,
      ornament: '♛',
      ornamentColor: '#E2B74E',
      accent: '#E2B74E',
    },
  },
  {
    id: 'sakura',
    name: 'Sakura',
    description: 'Soft blossom pink with a gentle petal motif.',
    unlock: { stat: 'likesGiven', target: 10, unit: 'posts liked', label: 'Like 10 posts in the Hub' },
    look: {
      background: '#FCE8EF',
      band: '#F8D5E1',
      border: '#E79AB4',
      frame: '#D9668C',
      frameWidth: 3,
      avatarBackground: '#FFF6F9',
      name: '#6E2443',
      subtitle: '#8E4D67',
      font: 'serif',
      tracking: 0.5,
      uppercase: false,
      ornament: '✿',
      ornamentColor: '#E07A9E',
      accent: '#D9668C',
    },
  },
  {
    id: 'imperial',
    name: 'Imperial',
    description: 'Lacquer red and gold, fit for the palace.',
    unlock: { stat: 'limitWins', target: 1, unit: 'limit hand won', label: 'Win a limit hand' },
    look: {
      background: '#6E0F12',
      band: '#8A1A1C',
      border: '#E9C25B',
      frame: '#F2D27C',
      frameWidth: 5,
      avatarBackground: '#4E0A0C',
      name: '#FBE6A6',
      subtitle: '#F1C9A0',
      font: 'serif',
      tracking: 3,
      uppercase: true,
      ornament: '龍',
      ornamentColor: '#E9C25B',
      accent: '#E9C25B',
    },
  },
];

export function findProfileTheme(id: string | null | undefined): ProfileThemeDef {
  return PROFILE_THEMES.find((t) => t.id === id) ?? PROFILE_THEMES.find((t) => t.id === DEFAULT_PROFILE_THEME)!;
}

export interface ProfileThemeStatus {
  unlocked: boolean;
  /** Null for designs everyone has. */
  progress: Progress | null;
}

/** Whether a design is unlocked, and how close it is. Admins have every design. */
export function profileThemeStatus(def: ProfileThemeDef, counts: UnlockCounts, isAdmin: boolean): ProfileThemeStatus {
  if (!def.unlock) return { unlocked: true, progress: null };
  const progress = countProgress(counts[def.unlock.stat], def.unlock.target, def.unlock.unit);
  return { unlocked: isAdmin || progress.fraction >= 1, progress };
}

/**
 * The design a profile shows. A saved choice that's no longer unlocked (say a game was deleted)
 * falls back to the default, but only where the unlock can be checked: visitors can't see the
 * owner's games, so for them the saved choice stands.
 */
export function shownProfileTheme(saved: string | undefined, status?: ProfileThemeStatus): ProfileThemeDef {
  if (status && !status.unlocked) return findProfileTheme(DEFAULT_PROFILE_THEME);
  return findProfileTheme(saved);
}

/** Unlocked first, then the rest from closest to furthest. Keeps the listed order for ties. */
export function sortByProgress<T>(items: T[], fractionOf: (item: T) => number): T[] {
  return items
    .map((item, i) => ({ item, i, f: fractionOf(item) }))
    .sort((a, b) => b.f - a.f || a.i - b.i)
    .map((x) => x.item);
}
