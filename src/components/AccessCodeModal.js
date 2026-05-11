import { Modal, Pressable, Text, View } from 'react-native';
import { styles } from '../styles/appStyles';

export function AccessCodeModal({ accessCode, onClose }) {
  return (
    <Modal animationType="fade" transparent visible={Boolean(accessCode)} onRequestClose={onClose}>
      <View style={styles.drawerOverlay}>
        <View style={styles.codeCard}>
          <Text style={styles.codeTitle}>Сохрани код входа</Text>
          <Text style={styles.codeValue}>{accessCode}</Text>
          <Text style={styles.codeHint}>Этот 8-значный код понадобится для следующих входов.</Text>
          <Pressable style={styles.chatPrimaryButton} onPress={onClose}>
            <Text style={styles.chatPrimaryButtonText}>Понятно</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
