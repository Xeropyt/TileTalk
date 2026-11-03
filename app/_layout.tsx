import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
        <Stack.Screen name="scan" options={{ title: 'Scan a hand' }} />
        <Stack.Screen name="profile/avatar" options={{ title: 'Avatar' }} />
        <Stack.Screen name="profile/titles" options={{ title: 'Titles' }} />
        <Stack.Screen name="player/[uid]" options={{ title: 'Player' }} />
        <Stack.Screen name="group/[id]" options={{ title: 'Group' }} />
        <Stack.Screen name="session/new" options={{ title: 'New game' }} />
        <Stack.Screen name="session/[id]/index" options={{ title: 'Game' }} />
        <Stack.Screen name="session/[id]/hand" options={{ title: 'Record hand', presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </AuthProvider>
  );
}
