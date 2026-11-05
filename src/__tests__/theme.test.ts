import { APP_THEMES, findAppTheme, DEFAULT_THEME_ID } from '../themes';

/** WCAG relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum]. 4.5 is WCAG AA for normal text; 3 for large or bold text
// and for borders and graphics.
const PAIRS: [string, string, number][] = [
  ['text', 'background', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'surfaceDeep', 4.5],
  ['textMuted', 'background', 4.5],
  ['textMuted', 'surface', 4.5],
  ['onPrimary', 'primary', 4.5],
  ['onAccent', 'accent', 4.5],
  ['onHighlight', 'highlight', 4.5],
  ['highlight', 'background', 3],
  ['highlight', 'surface', 3],
  ['success', 'surface', 3],
  ['warning', 'surface', 3],
  ['error', 'surface', 3],
  ['error', 'background', 3],
  ['secondary', 'surface', 3],
  ['accent', 'surface', 1.5],
  ['tileInk', 'tileFace', 7],
];

describe('app themes', () => {
  test('there are eight, with unique ids', () => {
    expect(APP_THEMES).toHaveLength(8);
    expect(new Set(APP_THEMES.map((t) => t.id)).size).toBe(8);
  });

  test('an unknown or missing theme falls back to the default', () => {
    expect(findAppTheme('nope').id).toBe(DEFAULT_THEME_ID);
    expect(findAppTheme(null).id).toBe(DEFAULT_THEME_ID);
  });

  test('every theme sets every token', () => {
    const keys = Object.keys(APP_THEMES[0].colors).sort();
    for (const t of APP_THEMES) expect(Object.keys(t.colors).sort()).toEqual(keys);
  });

  const cases = APP_THEMES.flatMap((t) => PAIRS.map(([fg, bg, min]) => [t.name, fg, bg, min] as [string, string, string, number]));
  test.each(cases)('%s: %s on %s is readable', (name, fg, bg, min) => {
    const c = APP_THEMES.find((t) => t.name === name)!.colors as unknown as Record<string, string>;
    const ratio = contrast(c[fg], c[bg]);
    if (ratio < min) throw new Error(`${name}: ${fg} on ${bg} is ${ratio.toFixed(2)}, needs ${min}`);
  });
});
