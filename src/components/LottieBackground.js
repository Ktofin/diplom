import LottieView from 'lottie-react-native';
import { View } from 'react-native';
import { lottieBackgrounds } from '../background/lottieBackgrounds';
import { styles } from '../styles/appStyles';

export function LottieBackground({ backgroundKey = 'default' }) {
  const source = lottieBackgrounds[backgroundKey] || lottieBackgrounds.default;

  return (
    <View pointerEvents="none" style={styles.lottieBackgroundWrap}>
      <LottieView autoPlay loop resizeMode="cover" source={source} style={styles.lottieBackground} />
    </View>
  );
}
