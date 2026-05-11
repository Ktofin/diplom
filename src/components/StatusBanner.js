import { Text, View } from 'react-native';
import { styles } from '../styles/appStyles';

export function StatusBanner({ text }) {
  return (
    <View style={styles.statusBanner}>
      <Text numberOfLines={2} style={styles.statusText}>
        {text}
      </Text>
    </View>
  );
}
