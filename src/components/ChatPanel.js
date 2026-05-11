import { Image } from 'react-native';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { styles } from '../styles/appStyles';

export function ChatPanel({
  attachedImageUri,
  assistantName,
  chatTitle,
  chatLoading,
  headerRight,
  headerTitle,
  inputText,
  messages,
  onAttachImage,
  onChangeText,
  onClearImage,
  onGenerateImage,
  onOpenHistory,
  onPressImage,
  onSend,
  showAttachButton = true,
  showGenerateButton = true,
  showHistoryButton = true,
  subtitle,
}) {
  return (
    <View style={styles.screenCard}>
      <View style={styles.screenHeader}>
        <View style={styles.chatHeaderRow}>
          {showHistoryButton ? (
            <Pressable style={styles.chatMenuButton} onPress={onOpenHistory}>
              <Text style={styles.chatMenuButtonText}>|||</Text>
            </Pressable>
          ) : null}
          <View style={styles.chatHeaderTextWrap}>
            <Text style={styles.screenTitle}>{headerTitle || 'Чат'}</Text>
            <Text style={styles.screenSubtitle}>{subtitle || chatTitle || 'Текущий диалог и изображения.'}</Text>
          </View>
          {headerRight || null}
        </View>
      </View>

      <ScrollView
        style={styles.chatMessages}
        contentContainerStyle={styles.chatMessagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <View key={message.id} style={[styles.chatBubble, isUser ? styles.chatBubbleUser : styles.chatBubbleAssistant]}>
              <Text style={styles.chatBubbleRole}>{isUser ? 'Ты' : assistantName}</Text>
              {message.imageUri ? (
                <Pressable onPress={() => onPressImage?.(message)} style={styles.chatImagePressable}>
                  <Image source={{ uri: message.imageUri }} style={styles.chatImage} />
                </Pressable>
              ) : null}
              <Text style={styles.chatBubbleText}>{message.content}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.chatComposer}>
        {attachedImageUri ? (
          <View style={styles.chatAttachmentCard}>
            <Image source={{ uri: attachedImageUri }} style={styles.chatAttachmentPreview} />
            <Pressable style={styles.chatSecondaryButton} onPress={onClearImage}>
              <Text style={styles.chatSecondaryButtonText}>Убрать фото</Text>
            </Pressable>
          </View>
        ) : null}

        <TextInput
          multiline
          numberOfLines={4}
          placeholder={`Напиши сообщение для ${assistantName}`}
          placeholderTextColor="#7dd3c7"
          style={styles.chatInput}
          value={inputText}
          onChangeText={onChangeText}
        />

        <View style={styles.chatActionRow}>
          {showAttachButton ? (
            <Pressable
              style={[styles.chatSecondaryButton, chatLoading && styles.chatPrimaryButtonDisabled]}
              onPress={onAttachImage}
              disabled={chatLoading}
            >
              <Text style={styles.chatSecondaryButtonText}>Галерея</Text>
            </Pressable>
          ) : null}

          {showGenerateButton ? (
            <Pressable
              style={[styles.chatSecondaryButton, chatLoading && styles.chatPrimaryButtonDisabled]}
              onPress={onGenerateImage}
              disabled={chatLoading}
            >
              <Text style={styles.chatSecondaryButtonText}>AI картинка</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={[
              styles.chatPrimaryButton,
              (!showAttachButton && !showGenerateButton) && styles.chatPrimaryButtonWide,
              chatLoading && styles.chatPrimaryButtonDisabled,
            ]}
            onPress={onSend}
            disabled={chatLoading}
          >
            {chatLoading ? <ActivityIndicator color="#ecfeff" /> : <Text style={styles.chatPrimaryButtonText}>Отправить</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
