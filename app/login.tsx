import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { displayNameOf, friendlyAuthError, isCancelledSignIn, useAuth } from '../src/auth';
import { colors, themedStyles } from '../src/theme';
import { Button, ErrorText, Field, Muted, Row, Screen, Tile, Title } from '../src/ui';

/** Optional: guests use the app without this. Creating an account keeps everything they've played. */
export default function Login() {
  const styles = useStyles();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { user, profile, isGuest, signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>(params.mode === 'signup' ? 'signup' : 'login');
  const [name, setName] = useState(profile?.displayName ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<false | 'email' | 'google'>(false);
  const [error, setError] = useState<string | null>(null);

  const done = () => (router.canGoBack() ? router.back() : router.replace('/?tab=profile'));

  if (user && !isGuest && !busy) {
    return (
      <Screen>
        <Title>You’re logged in</Title>
        <Muted>{user.email}</Muted>
        <Button title="Done" onPress={done} />
      </Screen>
    );
  }

  const submit = async () => {
    setError(null);
    if (mode === 'signup' && !name.trim()) {
      setError('Add the name your table knows you by.');
      return;
    }
    setBusy('email');
    try {
      if (mode === 'login') await signIn(email, password);
      else await signUp(email, password, name);
      done();
    } catch (e) {
      setError(friendlyAuthError(e));
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    setBusy('google');
    try {
      await signInWithGoogle(mode === 'signup' ? name : undefined);
      done();
    } catch (e) {
      if (!isCancelledSignIn(e)) setError(friendlyAuthError(e));
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={styles.hero}>
          <Row style={styles.tiles}>
            <Tile char="東" size={40} />
            <Tile char="中" size={40} color={colors.tileRed} />
            <Tile char="發" size={40} color={colors.tileGreen} />
          </Row>
          <Title>{mode === 'signup' ? 'Create an account' : 'Log in'}</Title>
          <Muted>
            {mode === 'signup'
              ? 'Keep your games and career stats on every device. Everything you’ve played as a guest comes with you.'
              : 'Use the account you created on another device.'}
          </Muted>
        </View>

        <Button
          title="Continue with Google"
          variant="tile"
          onPress={google}
          loading={busy === 'google'}
          disabled={busy === 'email'}
        />
        <Row style={styles.or}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or use email</Text>
          <View style={styles.orLine} />
        </Row>
        {mode === 'signup' ? (
          <Field label="Name" value={name} onChangeText={setName} placeholder="What your table calls you" autoCapitalize="words" />
        ) : null}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'login' ? 'password' : 'new-password'}
          onSubmitEditing={submit}
        />
        {mode === 'login' && isGuest ? (
          <Muted>
            Logging in switches to that account, and the games you played as {displayNameOf(profile)} won’t move over. To
            keep them, create an account instead.
          </Muted>
        ) : null}
        <ErrorText message={error} />
        <Button title={mode === 'login' ? 'Log in' : 'Create account'} onPress={submit} loading={busy === 'email'} disabled={busy === 'google'} />
        <Button
          title={mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
          variant="secondary"
          onPress={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError(null);
          }}
        />
        <Button title="Not now" variant="secondary" onPress={done} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const useStyles = themedStyles((colors) => ({
  flex: { flex: 1, backgroundColor: colors.background },
  hero: { gap: 10, paddingTop: 12, paddingBottom: 12 },
  tiles: { gap: 8, marginBottom: 8 },
  or: { alignItems: 'center', gap: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { color: colors.textMuted, fontSize: 13 },
}));
