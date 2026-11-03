import React, { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../ui';

/** A full-height page in the home pager. There's no header, so it clears the status bar itself. */
export function TabPage({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <Screen contentStyle={{ paddingTop: insets.top + 20 }}>{children}</Screen>;
}
