import { Image, Modal, Pressable, Text, View } from 'react-native';
import { styles } from '../styles/appStyles';

export function ImagePreviewModal({ image, onClose, onDownload }) {
  return (
    <Modal animationType="fade" transparent visible={Boolean(image)} onRequestClose={onClose}>
      <View style={styles.imagePreviewOverlay}>
        <Pressable style={styles.imagePreviewBackdrop} onPress={onClose} />
        <View style={styles.imagePreviewCard}>
          <Image source={{ uri: image?.uri }} style={styles.imagePreviewImage} resizeMode="contain" />
          <View style={styles.imagePreviewActionRow}>
            <Pressable style={styles.chatSecondaryButton} onPress={onClose}>
              <Text style={styles.chatSecondaryButtonText}>Закрыть</Text>
            </Pressable>
            <Pressable style={styles.chatPrimaryButton} onPress={onDownload}>
              <Text style={styles.chatPrimaryButtonText}>Скачать</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
