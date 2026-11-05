import { useSyncExternalStore } from 'react';
import { Platform, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppTheme, DEFAULT_THEME_ID, findAppTheme, Palette } from './themes';

export * from './themes';

export const radius = { tile: 6, control: 12, card: 16, pill: 999 };

// ---------- The chosen theme ----------
// Stored on this device only (localStorage on the web, AsyncStorage on phones). It's never sent
// to Firebase, so nobody else sees it.

const STORAGE_KEY = 'tiletalk.appTheme';

let current = findAppTheme(DEFAULT_THEME_ID);
let ready = false;
const listeners = new Set<() => void>();

/**
 * The current theme's colours, always up to date. Safe to read while rendering: every component
 * that styles itself with themedStyles or useAppTheme redraws when the theme changes.
 */
export const colors: Palette = { ...current.colors };

function apply(theme: AppTheme) {
  current = theme;
  Object.assign(colors, theme.colors);
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    // The page behind the app, and the browser's own bars.
    document.body.style.backgroundColor = theme.colors.surfaceDeep;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.colors.background);
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme.dark ? 'dark' : 'light');
  }
  listeners.forEach((l) => l());
}

function load() {
  if (Platform.OS === 'web') {
    // Read straight away on the web, so the first frame is already in the right theme.
    try {
      apply(findAppTheme(window.localStorage.getItem(STORAGE_KEY)));
    } catch {
      // Storage blocked (e.g. private browsing): the default theme it is.
    }
    ready = true;
    return;
  }
  AsyncStorage.getItem(STORAGE_KEY)
    .then((id) => apply(findAppTheme(id)))
    .catch(() => {})
    .finally(() => {
      ready = true;
      listeners.forEach((l) => l());
    });
}
load();

export function setAppTheme(id: string) {
  apply(findAppTheme(id));
  AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The current app theme. Components using it redraw when it changes. */
export function useAppTheme(): AppTheme {
  return useSyncExternalStore(subscribe, () => current);
}

/** False until the saved theme has been read, so the app doesn't flash the default first. */
export function useThemeReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready);
}

/**
 * Styles built from the theme's colours. Call at module level, then call the returned hook at the
 * top of each component. Each theme's styles are built once and kept.
 */
// Typed like StyleSheet.create, so style values keep their literal types ('row', '700').
type Styles = Parameters<typeof StyleSheet.create>[0];

export function themedStyles<S extends Styles>(factory: (colors: Palette) => S & Styles): () => Readonly<S> {
  const cache = new Map<string, Readonly<S>>();
  return function useStyles() {
    const theme = useAppTheme();
    let styles = cache.get(theme.id);
    if (!styles) {
      styles = StyleSheet.create(factory(theme.colors));
      cache.set(theme.id, styles);
    }
    return styles;
  };
}
