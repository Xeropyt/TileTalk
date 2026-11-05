/** The app themes and their design tokens, as data. The theme machinery is in theme.ts. */

/**
 * Design tokens. Every colour in the app comes from one of these, so a theme is just a set of
 * values for them. Components never pick colours of their own.
 */
export interface Palette {
  /** Page background. */
  background: string;
  /** Cards, list rows and other raised containers. */
  surface: string;
  /** Sunken areas: navigation bars, inputs, inset rows. */
  surfaceDeep: string;
  border: string;
  text: string;
  textMuted: string;
  /** Main actions: primary buttons, badges, notification dots. */
  primary: string;
  onPrimary: string;
  /** Supporting colour: immediate payouts, rare titles. */
  secondary: string;
  /** Standout colour: winning hands, legendary titles, value badges. */
  accent: string;
  onAccent: string;
  /** The selected or emphasised thing: chosen chips, your own leaderboard row, big numbers. */
  highlight: string;
  onHighlight: string;
  success: string;
  warning: string;
  error: string;
  /** Mahjong tiles. Kept close to real tiles in every theme so they read at a glance. */
  tileFace: string;
  tileEdge: string;
  tileInk: string;
  tileRed: string;
  tileGreen: string;
  tileBlue: string;
}

export interface AppTheme {
  id: string;
  name: string;
  description: string;
  /** Light status bar icons on dark themes, dark ones on light themes. */
  dark: boolean;
  colors: Palette;
}

const TILES = {
  tileFace: '#F3ECD7',
  tileEdge: '#CDBE95',
  tileInk: '#1F1B16',
  tileRed: '#B3302A',
  tileGreen: '#2D7A4B',
  tileBlue: '#2C4F86',
};

export const APP_THEMES: AppTheme[] = [
  {
    id: 'classic',
    name: 'Classic Mahjong',
    description: 'Jade felt, ivory tiles and lacquer red, like the table at home.',
    dark: true,
    colors: {
      background: '#0F3D32',
      surface: '#16503F',
      surfaceDeep: '#0A2C24',
      border: '#2A6B57',
      text: '#EEF4F0',
      textMuted: '#A3BFB3',
      primary: '#B3302A',
      onPrimary: '#FBF6EA',
      secondary: '#8FB4F0',
      accent: '#E8B84A',
      onAccent: '#1F1B16',
      highlight: '#F3ECD7',
      onHighlight: '#1F1B16',
      success: '#9BE7B8',
      warning: '#F2C66D',
      error: '#FF9B8F',
      ...TILES,
    },
  },
  {
    id: 'midnight_jade',
    name: 'Midnight Jade',
    description: 'Deep charcoal with jade green and a touch of gold.',
    dark: true,
    colors: {
      background: '#121614',
      surface: '#1C2420',
      surfaceDeep: '#0B0E0D',
      border: '#33433C',
      text: '#E8EFEB',
      textMuted: '#9DB2A8',
      primary: '#1F7A58',
      onPrimary: '#FFFFFF',
      secondary: '#7FC8B0',
      accent: '#C9A65A',
      onAccent: '#121614',
      highlight: '#A8E0C8',
      onHighlight: '#0B0E0D',
      success: '#8BE0B5',
      warning: '#E6C36A',
      error: '#FF8F86',
      ...TILES,
    },
  },
  {
    id: 'royal_dynasty',
    name: 'Royal Dynasty',
    description: 'Dark burgundy, imperial gold and warm cream.',
    dark: true,
    colors: {
      background: '#2A0F14',
      surface: '#3B161D',
      surfaceDeep: '#1D090D',
      border: '#62303A',
      text: '#F7EBDD',
      textMuted: '#D0B6A6',
      primary: '#D4A537',
      onPrimary: '#2A0F14',
      secondary: '#E8A9A2',
      accent: '#E8C46A',
      onAccent: '#2A0F14',
      highlight: '#F7EBDD',
      onHighlight: '#2A0F14',
      success: '#A8E0B0',
      warning: '#F0C26A',
      error: '#FF9A8E',
      ...TILES,
    },
  },
  {
    id: 'ocean_blue',
    name: 'Ocean Blue',
    description: 'Navy and muted blue with silver highlights.',
    dark: true,
    colors: {
      background: '#0E1A2E',
      surface: '#17283F',
      surfaceDeep: '#091221',
      border: '#2E4567',
      text: '#E9F0F8',
      textMuted: '#A6B7CC',
      primary: '#3A6FB0',
      onPrimary: '#FFFFFF',
      secondary: '#8FB4F0',
      accent: '#C9D3DE',
      onAccent: '#0E1A2E',
      highlight: '#DCE6F2',
      onHighlight: '#0E1A2E',
      success: '#8FE0C0',
      warning: '#F0CF7A',
      error: '#FF9C93',
      ...TILES,
    },
  },
  {
    id: 'sakura',
    name: 'Sakura',
    description: 'Soft pink and rose on off-white, light and airy.',
    dark: false,
    colors: {
      background: '#FBF3F5',
      surface: '#FFFFFF',
      surfaceDeep: '#F3E1E7',
      border: '#E3C2CD',
      text: '#3A2530',
      textMuted: '#74566A',
      primary: '#B83D67',
      onPrimary: '#FFFFFF',
      secondary: '#5865A8',
      accent: '#E8A3B9',
      onAccent: '#3A2530',
      highlight: '#8E2F52',
      onHighlight: '#FFFFFF',
      success: '#1F7346',
      warning: '#935D00',
      error: '#B3261E',
      ...TILES,
      tileFace: '#FFFDF8',
      tileEdge: '#D8C7A3',
    },
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Pure dark surfaces, quiet greys and almost no colour.',
    dark: true,
    colors: {
      background: '#0B0B0C',
      surface: '#18181B',
      surfaceDeep: '#050506',
      border: '#2E2E34',
      text: '#ECECEE',
      textMuted: '#A3A3AB',
      primary: '#E4E4E7',
      onPrimary: '#0B0B0C',
      secondary: '#9DA8BA',
      accent: '#BDBDC6',
      onAccent: '#0B0B0C',
      highlight: '#FFFFFF',
      onHighlight: '#0B0B0C',
      success: '#8EDCA8',
      warning: '#E8C77A',
      error: '#FF8A80',
      ...TILES,
    },
  },
  {
    id: 'ivory_luxe',
    name: 'Ivory Luxe',
    description: 'Cream and warm beige with champagne gold.',
    dark: false,
    colors: {
      background: '#F7F1E3',
      surface: '#FFFDF7',
      surfaceDeep: '#EEE4CE',
      border: '#D6C49B',
      text: '#2E2618',
      textMuted: '#6A5C43',
      primary: '#8A6A22',
      onPrimary: '#FFFFFF',
      secondary: '#4F6E95',
      accent: '#D9B76A',
      onAccent: '#2E2618',
      highlight: '#4A3A1A',
      onHighlight: '#FFFDF7',
      success: '#2A6E40',
      warning: '#8C6000',
      error: '#B3261E',
      ...TILES,
      tileFace: '#FFFDF5',
    },
  },
  {
    id: 'emerald_palace',
    name: 'Emerald Palace',
    description: 'Deep emerald and forest green with antique gold.',
    dark: true,
    colors: {
      background: '#06301F',
      surface: '#0C4430',
      surfaceDeep: '#03201A',
      border: '#1F6B4C',
      text: '#EAF5EE',
      textMuted: '#A2C7B3',
      primary: '#B8892E',
      onPrimary: '#06301F',
      secondary: '#9CC9E6',
      accent: '#C9A24D',
      onAccent: '#06301F',
      highlight: '#EFE3C2',
      onHighlight: '#06301F',
      success: '#9BE7B8',
      warning: '#E9C46A',
      error: '#FF9B8F',
      ...TILES,
    },
  },
];

export const DEFAULT_THEME_ID = 'classic';

export function findAppTheme(id: string | null | undefined): AppTheme {
  return APP_THEMES.find((t) => t.id === id) ?? APP_THEMES.find((t) => t.id === DEFAULT_THEME_ID)!;
}
