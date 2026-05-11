import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { VoiceWaveButton } from './VoiceWaveButton';
import { styles } from '../styles/appStyles';

export function LiveCameraOverlay({ cameraRef, isRecording, onToggleRecording, topContent }) {
  const [permission, requestPermission] = useCameraPermissions();
  const granted = permission?.granted;

  useEffect(() => {
    if (!permission) return;
    if (permission.granted) return;
    if (permission.canAskAgain === false) return;
    void requestPermission();
  }, [permission, requestPermission]);

  return (
    <View style={styles.cameraScreen}>
      {topContent || null}
      {granted ? (
        <CameraView ref={cameraRef} facing="back" style={styles.liveCameraPreview} />
      ) : (
        <View style={styles.liveCameraPermissionBox}>
          <Text style={styles.liveCameraTitle}>Камера</Text>
          <Text style={styles.liveCameraHint}>
            Разреши доступ к камере, чтобы показывать объект и сразу задавать вопрос голосом.
          </Text>
          <VoiceWaveButton isRecording={false} label="Разрешить доступ" onPress={requestPermission} />
        </View>
      )}

      {granted ? (
        <>
          <View style={styles.cameraHud}>
            <Text style={styles.liveCameraTitle}>Камера</Text>
            <Text style={styles.liveCameraHint}>Покажи объект и задай вопрос голосом</Text>
          </View>
          <View style={styles.cameraVoiceDock}>
            <VoiceWaveButton
              isRecording={isRecording}
              label={isRecording ? 'Идёт запись вопроса' : 'Нажми и говори'}
              onPress={onToggleRecording}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}
