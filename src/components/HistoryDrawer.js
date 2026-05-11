import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { styles } from '../styles/appStyles';

export function HistoryDrawer({
  activeChatId,
  chatList,
  historyOpen,
  modelKey,
  onClose,
  onCreateChat,
  onLoadChat,
  onSelectAssistant,
}) {
  return (
    <Modal animationType="fade" transparent visible={historyOpen} onRequestClose={onClose}>
      <View style={styles.drawerOverlay}>
        <Pressable style={styles.drawerBackdrop} onPress={onClose} />
        <View style={styles.drawerPanel}>
          <Text style={styles.drawerTitle}>Диалоги</Text>
          <Text style={styles.drawerSubtitle}>Все сохранённые чаты</Text>

          <Pressable style={styles.drawerCompactButton} onPress={() => onCreateChat(modelKey)}>
            <Text style={styles.drawerCompactButtonText}>Новый диалог</Text>
          </Pressable>

          <ScrollView style={styles.drawerList} contentContainerStyle={styles.drawerListContent} showsVerticalScrollIndicator={false}>
            {chatList.map((chat) => (
              <Pressable
                key={chat.id}
                style={[styles.drawerItem, chat.id === activeChatId && styles.drawerItemActive]}
                onPress={() => {
                  if (chat.assistant_key) {
                    onSelectAssistant(chat.assistant_key);
                  }
                  onLoadChat(chat.id);
                  onClose();
                }}
              >
                <Text style={styles.drawerItemTitle} numberOfLines={1}>
                  {chat.title}
                </Text>
                <Text style={styles.drawerItemSubtitle} numberOfLines={2}>
                  {chat.last_message?.content || 'Пустой диалог'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
