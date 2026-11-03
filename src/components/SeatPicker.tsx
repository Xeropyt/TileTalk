import React, { useRef, useState } from 'react';
import { Animated, LayoutRectangle, PanResponder, PanResponderInstance, StyleSheet, Text } from 'react-native';
import { WIND_CHARS, WIND_NAMES } from '../game/winds';
import { colors, radius } from '../theme';
import type { Player } from '../types';
import { Tile } from '../ui';

// Hold this long before a seat starts dragging, so a quick swipe still scrolls the page.
const HOLD_MS = 200;
const TAP_SLOP = 8;

/**
 * The seats (four, or three for a three-player game). Tap a seat to free it. Hold a player and drag them onto another seat to swap
 * the two (or move them, if it's empty). `onDragging` lets the screen stop scrolling meanwhile.
 */
export function SeatPicker({
  seats,
  onChange,
  onDragging,
}: {
  seats: (Player | null)[];
  onChange: (seats: (Player | null)[]) => void;
  onDragging?: (dragging: boolean) => void;
}) {
  const [drag, setDrag] = useState<{ from: number; over: number | null } | null>(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const layouts = useRef<LayoutRectangle[]>([]);
  // The responders are made once, so they read the latest props through this ref.
  const latest = useRef({ seats, onChange, onDragging });
  latest.current = { seats, onChange, onDragging };

  const swap = (from: number, to: number) => {
    const next = [...latest.current.seats];
    [next[from], next[to]] = [next[to], next[from]];
    latest.current.onChange(next);
  };

  const makeResponder = (i: number): PanResponderInstance => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dragging = false;
    let moved = false;
    let over: number | null = null;
    let grab = { x: 0, y: 0 };

    const stop = () => {
      clearTimeout(timer);
      if (dragging) {
        dragging = false;
        pan.setValue({ x: 0, y: 0 });
        setDrag(null);
        latest.current.onDragging?.(false);
      }
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        moved = false;
        over = i;
        grab = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
        if (!latest.current.seats[i]) return; // empty seats can be dropped on, not dragged
        timer = setTimeout(() => {
          dragging = true;
          pan.setValue({ x: 0, y: 0 });
          setDrag({ from: i, over: i });
          latest.current.onDragging?.(true);
        }, HOLD_MS);
      },
      onPanResponderMove: (_, g) => {
        if (!dragging) {
          if (Math.abs(g.dx) > TAP_SLOP || Math.abs(g.dy) > TAP_SLOP) {
            moved = true;
            clearTimeout(timer);
          }
          return;
        }
        pan.setValue({ x: g.dx, y: g.dy });
        const start = layouts.current[i];
        if (!start) return;
        const x = start.x + grab.x + g.dx;
        const y = start.y + grab.y + g.dy;
        const hit = layouts.current.findIndex((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
        const next = hit === -1 ? null : hit;
        if (next !== over) {
          over = next;
          setDrag({ from: i, over: next });
        }
      },
      // Until the hold kicks in, let the page scroll take over; once dragging, keep the touch.
      onPanResponderTerminationRequest: () => !dragging,
      onPanResponderRelease: () => {
        const wasDragging = dragging;
        const target = over;
        stop();
        if (wasDragging) {
          if (target !== null && target !== i) swap(i, target);
        } else if (!moved && latest.current.seats[i]) {
          latest.current.onChange(latest.current.seats.map((s, j) => (j === i ? null : s)));
        }
      },
      onPanResponderTerminate: stop,
    });
  };

  const responders = useRef<PanResponderInstance[]>([]);
  if (responders.current.length === 0) responders.current = [0, 1, 2, 3].map(makeResponder);

  return (
    <>
      {seats.map((p, i) => {
        const isDragged = drag?.from === i;
        const isTarget = !!drag && drag.over === i && drag.from !== i;
        return (
          <Animated.View
            key={i}
            {...responders.current[i].panHandlers}
            onLayout={(e) => (layouts.current[i] = e.nativeEvent.layout)}
            accessible
            accessibilityRole="button"
            accessibilityLabel={p ? `${WIND_NAMES[i]} seat: ${p.name}` : `${WIND_NAMES[i]} seat, empty`}
            accessibilityHint={p ? 'Tap to remove. Hold and drag onto another seat to swap.' : undefined}
            // Dragging isn't possible with a screen reader, so offer the swap as an action too.
            accessibilityActions={p ? [{ name: 'activate', label: 'Remove' }, { name: 'swapNext', label: 'Swap with the next seat' }] : []}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'swapNext') swap(i, (i + 1) % seats.length);
              else if (e.nativeEvent.actionName === 'activate') onChange(seats.map((s, j) => (j === i ? null : s)));
            }}
            style={[
              styles.seat,
              !p && styles.seatEmpty,
              isTarget && styles.seatTarget,
              isDragged && [styles.seatDragged, { transform: pan.getTranslateTransform() }],
            ]}
          >
            <Tile char={WIND_CHARS[i]} size={30} />
            <Text style={styles.seatText} numberOfLines={1}>
              {p ? `${p.avatar} ${p.name}` : 'Empty'}
            </Text>
          </Animated.View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  seat: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radius.card,
    backgroundColor: colors.feltRaised,
    borderWidth: 1,
    borderColor: colors.feltLine,
  },
  seatEmpty: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  seatTarget: { borderColor: colors.ivory, borderWidth: 2, borderStyle: 'solid' },
  seatDragged: { zIndex: 10, elevation: 8, opacity: 0.9, borderColor: colors.ivory },
  seatText: { color: colors.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
});
