import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Protected, useSignedInUser } from '../src/auth';
import { subscribeMySessions } from '../src/db';
import { recogniseHand } from '../src/scan/recognise';
import { colors, radius } from '../src/theme';
import type { Session } from '../src/types';
import { Button, Card, ErrorText, Loading, Muted, Screen, SectionTitle } from '../src/ui';

export default function ScanPage() {
  return (
    <Protected>
      <ScanScreen />
    </Protected>
  );
}

function ScanScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const user = useSignedInUser();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [active, setActive] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => subscribeMySessions(user.uid, (s) => setActive(s.filter((x) => x.status === 'active')), (e) => setError(e.message)),
    [user.uid],
  );

  if (!permission) return <Loading />;

  if (!permission.granted) {
    return (
      <Screen>
        <SectionTitle>Camera access</SectionTitle>
        <Muted>TileTalk uses the camera to photograph your winning hand. Photos stay on this device.</Muted>
        {permission.canAskAgain ? (
          <Button title="Allow camera" onPress={requestPermission} />
        ) : (
          <Button title="Open settings" onPress={() => Linking.openSettings()} />
        )}
      </Screen>
    );
  }

  const takePhoto = async () => {
    setError(null);
    try {
      const shot = await camera.current?.takePictureAsync({ quality: 0.7 });
      if (!shot) return;
      setPhoto(shot.uri);
      setChecking(true);
      // Always null until tile recognition is connected (see src/scan/recognise.ts). Once it is,
      // pass the patterns it found on to the record-hand screen.
      await recogniseHand(shot.uri);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const record = (id: string) => router.replace(`/session/${id}/hand`);
  const choices = sessionId ? active.filter((s) => s.id === sessionId) : active;

  return (
    <Screen>
      <View style={styles.frame}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.fill} accessibilityLabel="Photo of your hand" />
        ) : (
          <CameraView ref={camera} style={styles.fill} facing="back" onCameraReady={() => setReady(true)} />
        )}
      </View>

      {photo ? (
        <Button title="Retake" variant="secondary" onPress={() => setPhoto(null)} />
      ) : (
        <>
          <Muted>Lay your winning hand out in a row, face up, and fit every tile in the frame.</Muted>
          <Button title="Take photo" variant="tile" onPress={takePhoto} disabled={!ready} />
        </>
      )}

      <ErrorText message={error} />

      {photo && checking ? <Loading /> : null}
      {photo && !checking ? (
        <Card>
          <SectionTitle>Tile reading is coming soon</SectionTitle>
          <Muted>TileTalk can’t read tiles from photos yet. For now, record this hand by tapping its scoring patterns.</Muted>
          {choices.length === 0 ? (
            <Muted>You have no game in progress. Start one from a group on the Games page.</Muted>
          ) : (
            choices.map((s) => (
              <Button
                key={s.id}
                title={choices.length === 1 ? 'Record the hand' : `Record in: ${s.players.map((p) => p.name).join(', ')}`}
                onPress={() => record(s.id)}
              />
            ))
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.feltDeep,
    borderWidth: 1,
    borderColor: colors.feltLine,
  },
  fill: { flex: 1 },
});
