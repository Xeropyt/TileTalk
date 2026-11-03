import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/auth';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.feltDeep },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.felt },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ title: 'TileTalk', headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'Account', presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="profile/avatar" options={{ title: 'Avatar' }} />
        <Stack.Screen name="profile/titles" options={{ title: 'Titles' }} />
        <Stack.Screen name="player/[uid]" options={{ title: 'Player' }} />
        <Stack.Screen name="hub/share" options={{ title: 'Share your hand' }} />
        <Stack.Screen name="post/[id]" options={{ title: 'Hand' }} />
        <Stack.Screen name="group/[id]" options={{ title: 'Group' }} />
        <Stack.Screen name="session/new" options={{ title: 'New game' }} />
        <Stack.Screen name="session/[id]/index" options={{ title: 'Game' }} />
        <Stack.Screen name="session/[id]/hand" options={{ title: 'Record hand', presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <StatusBarShade />
    </AuthProvider>
  );
}

/**
 * Android draws the app under a see-through status bar, and the bar's own colour can't be set.
 * This solid strip sits behind the clock and battery on every screen, so pages scroll under it
 * instead of showing through.
 */
function StatusBarShade() {
  const { top } = useSafeAreaInsets();
  if (top === 0) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: top, backgroundColor: colors.feltDeep }}
    />
  );
}
