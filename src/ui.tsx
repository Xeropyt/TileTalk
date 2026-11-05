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
import { colors, radius, themedStyles } from './theme';

export function Screen({
  children,
  contentStyle,
  scrollEnabled = true,
}: {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scrollEnabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <ScrollView
      style={styles.scroll}
      scrollEnabled={scrollEnabled}
      contentContainerStyle={[styles.screen, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Loading() {
  const styles = useStyles();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.highlight} size="large" />
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.title}>{children}</Text>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Body({ children, style }: { children: ReactNode; style?: object }) {
  const styles = useStyles();
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  const styles = useStyles();
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function ErrorText({ message }: { message: string | null }) {
  const styles = useStyles();
  if (!message) return null;
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {message}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
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
  const styles = useStyles();
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
        <ActivityIndicator color={isTile ? colors.tileInk : variant === 'primary' ? colors.onPrimary : colors.text} />
      ) : (
        <Text style={[styles.buttonText, variant === 'primary' && styles.buttonTextPrimary, isTile && { color: colors.tileInk }]}>{title}</Text>
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
  const styles = useStyles();
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
  const styles = useStyles();
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
  color = colors.tileInk,
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
  const styles = useStyles();
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

/** A bar filling up towards an unlock, with a line like "7/10 games" under it. */
export function ProgressBar({ fraction, text }: { fraction: number; text: string }) {
  const styles = useStyles();
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return (
    <View style={styles.progress} accessible accessibilityRole="progressbar" accessibilityLabel={text} accessibilityValue={{ min: 0, max: 100, now: pct }}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }, pct === 100 && styles.progressDone]} />
      </View>
      <Text style={styles.progressText}>{text}</Text>
    </View>
  );
}

export function formatPoints(n: number): string {
  if (n > 0) return `+${n}`;
  return `${n}`;
}

const useStyles = themedStyles((colors) => ({
  scroll: { flex: 1, backgroundColor: colors.background },
  screen: {
    padding: 20,
    paddingBottom: 56,
    gap: 18,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.4 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  body: { color: colors.text, fontSize: 16, lineHeight: 22 },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.error, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  field: { gap: 6 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: colors.surfaceDeep,
    color: colors.text,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
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
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { borderWidth: 1, borderColor: colors.border },
  buttonTile: {
    backgroundColor: colors.tileFace,
    borderBottomWidth: 4,
    borderBottomColor: colors.tileEdge,
  },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  buttonTextPrimary: { color: colors.onPrimary },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.highlight, borderColor: colors.highlight },
  chipText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  chipTextSelected: { color: colors.onHighlight },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSymbol: { color: colors.text, fontSize: 20, fontWeight: '700' },
  stepperValue: { color: colors.text, fontSize: 17, fontWeight: '700', minWidth: 22, textAlign: 'center' },
  progress: { gap: 4, paddingTop: 4 },
  progressTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceDeep, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.accent },
  progressDone: { backgroundColor: colors.success },
  progressText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tile: {
    backgroundColor: colors.tileFace,
    borderRadius: radius.tile,
    borderBottomColor: colors.tileEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
