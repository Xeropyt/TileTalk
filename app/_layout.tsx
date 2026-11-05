import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/auth';
import { GameResultsKeeper } from '../src/stats';
import { colors, useAppTheme, useThemeReady } from '../src/theme';

// On the web, expo-router reports no safe area at all, so pages sat under an iPhone's clock. This
// provider reads the real sizes from the browser. The app already gets them on iPhone and Android.
const WebSafeArea = Platform.OS === 'web' ? SafeAreaProvider : React.Fragment;

export default function RootLayout() {
  const theme = useAppTheme();
  // On phones the saved theme is read from storage first, so the app doesn't flash the default.
  if (!useThemeReady()) return null;
  return (
    <WebSafeArea>
      <AuthProvider>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        <GameResultsKeeper />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surfaceDeep },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ title: 'TileTalk', headerShown: false }} />
          <Stack.Screen name="login" options={{ title: 'Account', presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="google-auth" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="inbox" options={{ title: 'Inbox' }} />
          <Stack.Screen name="profile/avatar" options={{ title: 'Avatar' }} />
          <Stack.Screen name="profile/titles" options={{ title: 'Titles' }} />
          <Stack.Screen name="profile/appearance" options={{ title: 'App theme' }} />
          <Stack.Screen name="profile/customise" options={{ title: 'Profile customisation' }} />
          <Stack.Screen name="player/[uid]" options={{ title: 'Player' }} />
          <Stack.Screen name="hub/share" options={{ title: 'Share your hand' }} />
          <Stack.Screen name="post/[id]" options={{ title: 'Hand' }} />
          <Stack.Screen name="group/[id]" options={{ title: 'Group' }} />
          <Stack.Screen name="session/new" options={{ title: 'New game' }} />
          <Stack.Screen name="session/[id]/index" options={{ title: 'Game' }} />
          <Stack.Screen name="session/[id]/hand" options={{ title: 'Record hand', presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      </AuthProvider>
    </WebSafeArea>
  );
}
