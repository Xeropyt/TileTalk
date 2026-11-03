import React, { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius } from './theme';

export function Screen({ children, contentStyle }: { children: ReactNode; contentStyle?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.screen, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.ivory} size="large" />
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Body({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {message}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={styles.input}
        accessibilityLabel={label}
        {...props}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'tile';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isTile = variant === 'tile';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        isTile && styles.buttonTile,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isTile ? colors.ink : colors.ivory} />
      ) : (
        <Text style={[styles.buttonText, isTile && { color: colors.ink }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Stepper({
  value,
  max,
  onChange,
  disabled,
  label,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove one ${label}`}
        onPress={() => onChange(Math.max(0, value - 1))}
        disabled={disabled || value === 0}
        style={[styles.stepperButton, (disabled || value === 0) && styles.disabled]}
      >
        <Text style={styles.stepperSymbol}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue} accessibilityLabel={`${value} ${label}`}>
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add one ${label}`}
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        style={[styles.stepperButton, (disabled || value >= max) && styles.disabled]}
      >
        <Text style={styles.stepperSymbol}>+</Text>
      </Pressable>
    </View>
  );
}

/** An ivory mahjong tile with a character on it. The app's main visual motif. */
export function Tile({
  char,
  color = colors.ink,
  size = 44,
  label,
  dim,
}: {
  char: string;
  color?: string;
  size?: number;
  label?: string;
  dim?: boolean;
}) {
  return (
    <View
      accessible={!!label}
      accessibilityLabel={label}
      style={[
        styles.tile,
        { width: size, height: Math.round(size * 1.3), borderBottomWidth: Math.max(3, size / 12) },
        dim && { opacity: 0.45 },
      ]}
    >
      <Text style={{ fontSize: Math.round(size * 0.58), color, fontWeight: '700' }}>{char}</Text>
    </View>
  );
}

export function formatPoints(n: number): string {
  if (n > 0) return `+${n}`;
  return `${n}`;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.felt },
  screen: {
    padding: 20,
    paddingBottom: 56,
    gap: 18,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.felt },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.4 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  body: { color: colors.text, fontSize: 16, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.loss, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: colors.feltRaised,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.feltLine,
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  field: { gap: 6 },
  label: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: colors.feltDeep,
    color: colors.text,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.feltLine,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.control,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: colors.lacquer },
  buttonSecondary: { borderWidth: 1, borderColor: colors.feltLine },
  buttonTile: {
    backgroundColor: colors.ivory,
    borderBottomWidth: 4,
    borderBottomColor: colors.ivoryEdge,
  },
  buttonText: { color: colors.ivory, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.feltLine,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.ivory, borderColor: colors.ivory },
  chipText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  chipTextSelected: { color: colors.ink },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.feltLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSymbol: { color: colors.text, fontSize: 20, fontWeight: '700' },
  stepperValue: { color: colors.text, fontSize: 17, fontWeight: '700', minWidth: 22, textAlign: 'center' },
  tile: {
    backgroundColor: colors.ivory,
    borderRadius: radius.tile,
    borderBottomColor: colors.ivoryEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
