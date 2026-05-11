import { Audio } from 'expo-av';
import { isWeb } from '../live2d/platform';

let currentWebAudio = null;
let currentNativeSound = null;

async function stopExisting() {
  if (isWeb) {
    if (currentWebAudio) {
      currentWebAudio.pause();
      currentWebAudio.currentTime = 0;
      currentWebAudio = null;
    }
    return;
  }

  if (currentNativeSound) {
    await currentNativeSound.stopAsync().catch(() => undefined);
    await currentNativeSound.unloadAsync().catch(() => undefined);
    currentNativeSound = null;
  }
}

export async function playBase64Wav(audioBase64, onFinish) {
  const uri = `data:audio/wav;base64,${audioBase64}`;
  await stopExisting();

  if (isWeb) {
    const audio = new window.Audio(uri);
    currentWebAudio = audio;
    await new Promise((resolve, reject) => {
      audio.onended = () => {
        currentWebAudio = null;
        onFinish?.();
        resolve();
      };
      audio.onerror = (error) => {
        currentWebAudio = null;
        reject(error);
      };
      audio.play().catch(reject);
    });
    return;
  }

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
  });

  let soundInstance = null;
  await new Promise(async (resolve, reject) => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync().catch(() => undefined);
            currentNativeSound = null;
            onFinish?.();
            resolve();
          }
        }
      );

      soundInstance = sound;
      currentNativeSound = sound;
    } catch (error) {
      reject(error);
    }
  });

  currentNativeSound = soundInstance;
}

export async function stopAudioPlayback() {
  await stopExisting();
}
