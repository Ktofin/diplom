import { Audio } from 'expo-av';

export async function requestRecordingPermission() {
  const permission = await Audio.requestPermissionsAsync();
  return permission.granted;
}

export async function startRecording() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
  });

  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
  return recording;
}

export async function stopRecording(recording) {
  if (!recording) return null;

  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
  });

  return uri;
}
