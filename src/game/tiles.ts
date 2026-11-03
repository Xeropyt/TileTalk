// Tiles by code. Each code is also the artwork's file name: assets/tiles/<code>.svg.

const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const SUIT_NAMES = { man: 'Characters', pin: 'Dots', sou: 'Bamboo' } as const;

/** The 34 kinds of tile that can be in a hand, in the usual sorting order. */
export const HAND_TILES: string[] = [
  ...numbers.map((n) => `man${n}`),
  ...numbers.map((n) => `pin${n}`),
  ...numbers.map((n) => `sou${n}`),
  'east',
  'south',
  'west',
  'north',
  'red',
  'green',
  'white',
];

/** Flowers and seasons. Set aside when drawn, so shown apart from the hand. */
export const BONUS_TILES: string[] = [1, 2, 3, 4].flatMap((n) => [`flower${n}`, `season${n}`]);

const HONOUR_NAMES: Record<string, string> = {
  east: 'East wind',
  south: 'South wind',
  west: 'West wind',
  north: 'North wind',
  red: 'Red dragon',
  green: 'Green dragon',
  white: 'White dragon',
};
const FLOWERS = ['Plum', 'Orchid', 'Chrysanthemum', 'Bamboo'];
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

/** A spoken name for a tile, for screen readers and labels. */
export function tileName(code: string): string {
  const suited = /^(man|pin|sou)([1-9])$/.exec(code);
  if (suited) return `${suited[2]} of ${SUIT_NAMES[suited[1] as keyof typeof SUIT_NAMES]}`;
  const bonus = /^(flower|season)([1-4])$/.exec(code);
  if (bonus) {
    const n = Number(bonus[2]);
    return bonus[1] === 'flower' ? `${FLOWERS[n - 1]} (flower ${n})` : `${SEASONS[n - 1]} (season ${n})`;
  }
  return HONOUR_NAMES[code] ?? code;
}

/** How many of each tile there are in a set. */
export function maxCopies(code: string): number {
  return BONUS_TILES.includes(code) ? 1 : 4;
}

/** A winning hand is 14 tiles, plus one more for each kong (up to four). */
export const MIN_HAND_TILES = 14;
export const MAX_HAND_TILES = 18;

const ORDER = [...HAND_TILES, ...BONUS_TILES];

export function sortTiles(tiles: string[]): string[] {
  return [...tiles].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
}
