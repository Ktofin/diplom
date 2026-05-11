import LottieView from 'lottie-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { robotAnimationStates } from '../background/robotAnimationStates';
import { styles } from '../styles/appStyles';

export function LottieCharacterStage({ onPress, state = 'idle' }) {
  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking' || state === 'say';
  const baseSource = isThinking && !isSpeaking ? robotAnimationStates.thinking : robotAnimationStates.idle;
  const overlaySource = isSpeaking ? robotAnimationStates.say : null;

  return (
    <View style={styles.stage}>
      <Pressable style={styles.robotStagePressable} onPress={onPress}>
        <View style={styles.robotStageStack}>
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <LottieView
              autoPlay
              loop
              resizeMode="contain"
              source={baseSource}
              style={styles.robotStageLottie}
              key={`base-${state}`}
            />
          </View>

          {overlaySource ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
              <LottieView
                autoPlay
                loop
                resizeMode="contain"
                source={overlaySource}
                style={styles.robotStageOverlayLottie}
                key={`overlay-${state}`}
              />
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}
