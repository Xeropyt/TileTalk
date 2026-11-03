import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { WIND_NAMES, wallBreak } from '../game/winds';
import { colors, radius } from '../theme';
import { Button, Card, Chip, Row, SectionTitle } from '../ui';

// Pip positions on a 3x3 grid as [row, column].
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2]],
};

const randomFace = () => 1 + Math.floor(Math.random() * 6);

function Die({ value }: { value: number }) {
  // Chinese dice traditionally have red pips on the 1 and 4 faces.
  const pipColor = value === 1 || value === 4 ? colors.lacquer : colors.ink;
  const pipSize = value === 1 ? 14 : 10;
  return (
    <View style={styles.die} accessible accessibilityLabel={`Die showing ${value}`}>
      {PIPS[value].map(([r, c], i) => (
        <View
          key={i}
          style={[
            styles.pip,
            {
              width: pipSize,
              height: pipSize,
              borderRadius: pipSize / 2,
              backgroundColor: pipColor,
              top: 8 + r * 15 + (10 - pipSize) / 2,
              left: 8 + c * 15 + (10 - pipSize) / 2,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function DiceRoller({ dealerIndex, playerNames }: { dealerIndex: number; playerNames: string[] }) {
  const [count, setCount] = useState<2 | 3>(2);
  const [values, setValues] = useState<number[] | null>(null);
  const [rolling, setRolling] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const roll = async () => {
    const finalValues = Array.from({ length: count }, randomFace);
    const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
    if (reduceMotion) {
      setValues(finalValues);
      return;
    }
    setRolling(true);
    let ticks = 0;
    timer.current = setInterval(() => {
      ticks += 1;
      if (ticks >= 8) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setValues(finalValues);
        setRolling(false);
      } else {
        setValues(Array.from({ length: count }, randomFace));
      }
    }, 70);
  };

  const total = values?.reduce((s, v) => s + v, 0) ?? 0;
  const brk = values && !rolling ? wallBreak(total, dealerIndex, playerNames.length) : null;

  return (
    <Card>
      <SectionTitle>Dice</SectionTitle>
      <Row>
        {([2, 3] as const).map((n) => (
          <Chip
            key={n}
            label={`${n} dice`}
            selected={count === n}
            onPress={() => {
              setCount(n);
              setValues(null);
            }}
          />
        ))}
      </Row>
      <Row style={styles.diceRow}>
        {(values ?? Array.from({ length: count }, () => 0)).map((v, i) =>
          v ? <Die key={i} value={v} /> : <View key={i} style={[styles.die, styles.dieEmpty]} />,
        )}
      </Row>
      {brk ? (
        <Text style={styles.result} accessibilityLiveRegion="polite">
          Total {total}. Break the wall in front of {playerNames[brk.playerIndex]} (
          {brk.offset === 0 ? 'the dealer' : `${WIND_NAMES[brk.offset]} seat`}).
        </Text>
      ) : null}
      <Button title={rolling ? 'Rolling…' : 'Roll dice'} variant="tile" onPress={roll} disabled={rolling} />
    </Card>
  );
}

const styles = StyleSheet.create({
  diceRow: { gap: 12, paddingVertical: 4 },
  die: {
    width: 56,
    height: 56,
    borderRadius: radius.control,
    backgroundColor: colors.ivory,
    borderBottomWidth: 4,
    borderBottomColor: colors.ivoryEdge,
    position: 'relative',
  },
  dieEmpty: { opacity: 0.25 },
  pip: { position: 'absolute' },
  result: { color: colors.text, fontSize: 16, lineHeight: 22 },
});
