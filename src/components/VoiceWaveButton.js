import { useEffect, useRef } from 'react';
import LottieView from 'lottie-react-native';
import { Pressable, Text, View } from 'react-native';
import { styles } from '../styles/appStyles';

const micWaveAnimation = require('../../assets/mic-wave.json');

export function VoiceWaveButton({ isRecording, label, onPress }) {
  const animationRef = useRef(null);

  useEffect(() => {
    if (isRecording) {
      animationRef.current?.play();
      return;
    }

    animationRef.current?.reset();
    animationRef.current?.pause();
  }, [isRecording]);

  return (
    <View style={styles.voiceWaveWrap}>
      <Pressable style={styles.voiceWaveButton} onPress={onPress}>
        <LottieView
          ref={animationRef}
          autoPlay={false}
          loop={isRecording}
          source={micWaveAnimation}
          style={styles.voiceWaveAnimation}
        />
      </Pressable>
      {label ? <Text style={styles.voiceWaveLabel}>{label}</Text> : null}
    </View>
  );
}
