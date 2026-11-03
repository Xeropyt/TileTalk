import React, { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollViewInstance,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth';
import { GamesPage } from '../src/screens/GamesPage';
import { HubPage } from '../src/screens/HubPage';
import { LeaderboardPage } from '../src/screens/LeaderboardPage';
import { ProfilePage } from '../src/screens/ProfilePage';
import { RulesPage } from '../src/screens/RulesPage';
import { colors } from '../src/theme';
import { Tile } from '../src/ui';

type TabId = 'games' | 'rules' | 'hub' | 'leaderboard' | 'profile';

const TABS: { id: TabId; label: string; page: () => ReactNode }[] = [
  { id: 'games', label: 'Games', page: () => <GamesPage /> },
  { id: 'rules', label: 'Rules', page: () => <RulesPage /> },
  { id: 'hub', label: 'Hub', page: () => <HubPage /> },
  { id: 'leaderboard', label: 'Leaderboard', page: () => <LeaderboardPage /> },
  { id: 'profile', label: 'Profile', page: () => <ProfilePage /> },
];

/**
 * The main pages sit side by side in one horizontal pager. Swipe between them, or tap
 * the bar at the bottom to scroll to one. Link to a page with /?tab=rules, /?tab=hub,
 * /?tab=leaderboard or /?tab=profile.
 */
export default function Home() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const requested = Math.max(0, TABS.findIndex((t) => t.id === tab));
  const { width } = useWindowDimensions();
  const pager = useRef<ScrollViewInstance>(null);
  const scrollX = useRef(new Animated.Value(requested * width)).current;
  const [index, setIndex] = useState(requested);
  const indexRef = useRef(index);
  indexRef.current = index;

  const goTo = (i: number, animated = true) => pager.current?.scrollTo({ x: i * width, animated });

  // Follow /?tab=... links, and keep the current page in view when the window is resized or rotated.
  useEffect(() => {
    setIndex(requested);
    goTo(requested, false);
  }, [requested]);
  useEffect(() => goTo(indexRef.current, false), [width]);

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: Platform.OS !== 'web',
    listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.x / width);
      if (i !== indexRef.current && i >= 0 && i < TABS.length) setIndex(i);
    },
  });

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentOffset={{ x: requested * width, y: 0 }}
        style={styles.pager}
      >
        {TABS.map((t, i) => (
          <View
            key={t.id}
            // Pages must be exactly the pager's height so each one scrolls on its own. Without
            // this, on web they grow to fit their content and nothing can scroll vertically.
            style={{ width, height: '100%' }}
            // Screen readers only see the page that's on screen.
            importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}
            accessibilityElementsHidden={i !== index}
          >
            {t.page()}
          </View>
        ))}
      </Animated.ScrollView>
      <TabBar index={index} scrollX={scrollX} width={width} onSelect={(i) => goTo(i)} />
    </View>
  );
}

function TabBar({
  index,
  scrollX,
  width,
  onSelect,
}: {
  index: number;
  scrollX: Animated.Value;
  width: number;
  onSelect: (i: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const slot = width / TABS.length;
  const icons: Record<TabId, ReactNode> = {
    games: <Tile char="東" size={20} />,
    rules: <Tile char="書" size={20} color={colors.lacquer} />,
    hub: <Tile char="聚" size={20} color={colors.tileGreen} />,
    leaderboard: <Tile char="榜" size={20} color={colors.tileBlue} />,
    profile: <Text style={styles.avatar}>{profile?.avatar ?? '🀄'}</Text>,
  };

  // The indicator slides with the pager, so it tracks a swipe as well as a tap.
  const indicatorX = scrollX.interpolate({
    inputRange: [0, width * (TABS.length - 1)],
    outputRange: [0, slot * (TABS.length - 1)],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      <Animated.View style={[styles.indicator, { width: slot, transform: [{ translateX: indicatorX }] }]}>
        <View style={styles.indicatorPill} />
      </Animated.View>
      {TABS.map((t, i) => {
        const opacity = scrollX.interpolate({
          inputRange: [(i - 1) * width, i * width, (i + 1) * width],
          outputRange: [0.55, 1, 0.55],
          extrapolate: 'clamp',
        });
        return (
          <Pressable
            key={t.id}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: i === index }}
            onPress={() => onSelect(i)}
            style={styles.tab}
          >
            <Animated.View style={[styles.tabInner, { opacity }]}>
              {icons[t.id]}
              <Text style={[styles.label, i === index && styles.labelActive]}>{t.label}</Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.felt },
  pager: { flex: 1 },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.feltDeep,
    borderTopWidth: 1,
    borderTopColor: colors.feltLine,
    paddingTop: 8,
  },
  indicator: { position: 'absolute', top: 0, left: 0, alignItems: 'center' },
  indicatorPill: { width: 36, height: 3, borderRadius: 2, backgroundColor: colors.ivory },
  tab: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  tabInner: { alignItems: 'center', gap: 4 },
  avatar: { fontSize: 22, lineHeight: 28 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  labelActive: { color: colors.ivory },
});
