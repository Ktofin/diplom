import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { createChat, fetchChat, fetchChats, generateImage, sendChat } from '../ai/api';
import { dataUriToBase64, downloadBase64Image, getMimeTypeFromDataUri, uriToBase64 } from '../ai/files';
import {
  buildMessagePayload,
  createImageAttachment,
  createMessage,
  mapStoredMessage,
} from '../app/chatHelpers';

export function useChatController({
  authSession,
  currentModel,
  emotionProfile,
  modelKey,
  postToStage,
  setActiveView,
  setModelKey,
  setStatusText,
  speakAssistantText,
}) {
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [chatList, setChatList] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeChatTitle, setActiveChatTitle] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const handleOpenImagePreview = useCallback((message) => {
    if (!message?.imageUri) return;

    setPreviewImage({
      uri: message.imageUri,
      base64: message.imageBase64 || dataUriToBase64(message.imageUri),
      mimeType: message.imageMimeType || getMimeTypeFromDataUri(message.imageUri) || 'image/png',
    });
  }, []);

  const handleCloseImagePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);

  const handleDownloadPreviewImage = useCallback(async () => {
    if (!previewImage?.base64) {
      setStatusText('Не удалось подготовить изображение к скачиванию');
      return;
    }

    try {
      const result = await downloadBase64Image({
        base64: previewImage.base64,
        mimeType: previewImage.mimeType,
        fileName: `generated-${Date.now()}`,
      });

      if (result.mode === 'native' && result.fileUri) {
        setStatusText(`Изображение сохранено: ${result.fileUri}`);
      } else {
        setStatusText('Скачивание изображения началось');
      }
    } catch (error) {
      setStatusText(`Ошибка скачивания: ${String(error?.message || error)}`);
    }
  }, [previewImage, setStatusText]);

  const handleAttachImageFromGallery = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setStatusText('Нет доступа к галерее');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const base64 =
        asset.base64 || (asset.uri?.startsWith('data:') ? dataUriToBase64(asset.uri) : await uriToBase64(asset.uri));

      setAttachedImage(createImageAttachment(asset.uri, base64, asset.mimeType || 'image/jpeg'));
      setStatusText('Изображение прикреплено');
    } catch (error) {
      setStatusText(`Ошибка изображения: ${String(error?.message || error)}`);
    }
  }, [setStatusText]);

  const syncChatList = useCallback(
    async (session = authSession) => {
      if (!session?.token) return [];
      const payload = await fetchChats(session.token);
      const chats = payload?.chats || [];
      setChatList(chats);
      return chats;
    },
    [authSession]
  );

  const loadChatById = useCallback(
    async (chatId, session = authSession) => {
      if (!session?.token || !chatId) return null;

      const payload = await fetchChat(session.token, chatId);
      setActiveChatId(payload.id);
      setActiveChatTitle(payload.title);
      setMessages((payload.messages || []).map(mapStoredMessage));
      return payload;
    },
    [authSession]
  );

  const createNewChat = useCallback(
    async (assistantKey = modelKey, session = authSession, options = {}) => {
      if (!session?.token) return null;

      setModelKey(assistantKey);
      const payload = await createChat(session.token, assistantKey, options.title || null);
      await syncChatList(session);
      await loadChatById(payload.id, session);
      setHistoryOpen(false);
      if (options.openChatView !== false) {
        setActiveView('chat');
      }
      return payload;
    },
    [authSession, loadChatById, modelKey, setActiveView, setModelKey, syncChatList]
  );

  const bootstrapChats = useCallback(
    async (session = authSession) => {
      if (!session?.token) return;

      const chats = await syncChatList(session);
      if (chats.length === 0) {
        await createNewChat(modelKey, session, { openChatView: false });
        return;
      }

      const preferredChat = activeChatId && chats.some((chat) => chat.id === activeChatId)
        ? chats.find((chat) => chat.id === activeChatId)
        : chats[0];
      if (preferredChat?.assistant_key) {
        setModelKey(preferredChat.assistant_key);
      }
      await loadChatById(preferredChat?.id, session);
    },
    [activeChatId, authSession, createNewChat, loadChatById, modelKey, setModelKey, syncChatList]
  );

  const ensureActiveChat = useCallback(async () => {
    if (activeChatId) return activeChatId;
    const payload = await createNewChat(modelKey);
    return payload?.id || null;
  }, [activeChatId, createNewChat, modelKey]);

  const sendMessage = useCallback(
    async (textOverride = null, imageOverride = attachedImage) => {
      const trimmedText = (textOverride ?? inputText).trim();
      if (!trimmedText && !imageOverride) {
        setStatusText('Нужен текст или изображение');
        return;
      }

      const chatId = await ensureActiveChat();
      if (!chatId || !authSession?.token) {
        setStatusText('Нет активного диалога');
        return;
      }

      const imageBase64 = imageOverride?.base64 || null;
      const userMessage = createMessage(
        'user',
        trimmedText,
        imageOverride?.uri || null,
        imageBase64,
        imageOverride?.mimeType || null
      );

      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setInputText('');
      setAttachedImage(null);
      setChatLoading(true);
      setStatusText(`Отправляю сообщение ${currentModel?.characterName || 'AI'}...`);

      try {
        const response = await sendChat(buildMessagePayload(nextMessages), null, modelKey, chatId, authSession.token);

        const assistantText = response?.message?.content?.trim() || 'Не удалось получить ответ.';
        await syncChatList();
        await loadChatById(chatId);
        setStatusText(`${currentModel?.characterName || 'AI'} ответил${currentModel?.gender === 'female' ? 'а' : ''}`);
        if (emotionProfile.successReaction) {
          postToStage({ type: 'triggerReaction', name: emotionProfile.successReaction, durationMs: 1800 });
        }
        await speakAssistantText(assistantText);
      } catch (error) {
        setStatusText(`Ошибка ответа: ${String(error?.message || error)}`);
        if (emotionProfile.errorReaction) {
          postToStage({ type: 'triggerReaction', name: emotionProfile.errorReaction, durationMs: 2200 });
        }
        setMessages((prev) => [...prev, createMessage('assistant', `Ошибка: ${String(error?.message || error)}`)]);
      } finally {
        setChatLoading(false);
      }
    },
    [
      attachedImage,
      authSession?.token,
      currentModel?.characterName,
      currentModel?.gender,
      emotionProfile.errorReaction,
      emotionProfile.successReaction,
      ensureActiveChat,
      inputText,
      loadChatById,
      messages,
      modelKey,
      postToStage,
      setStatusText,
      speakAssistantText,
      syncChatList,
    ]
  );

  const handleGenerateImage = useCallback(async () => {
    const prompt = inputText.trim();
    if (!prompt) {
      setStatusText('Нужен текстовый промпт для генерации изображения');
      return;
    }

    const chatId = await ensureActiveChat();
    if (!chatId || !authSession?.token) {
      setStatusText('Нет активного диалога');
      return;
    }

    const userMessage = createMessage('user', `Сгенерируй изображение: ${prompt}`);
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setAttachedImage(null);
    setChatLoading(true);
    setStatusText('Генерирую изображение...');

    try {
      const payload = await generateImage(prompt, '', chatId, modelKey, authSession.token);
      const assistantText = `${currentModel?.characterName || 'AI'} сгенерировал изображение по твоему запросу.`;
      await syncChatList();
      await loadChatById(chatId);
      setStatusText('Изображение готово');

      if (emotionProfile.successReaction) {
        postToStage({ type: 'triggerReaction', name: emotionProfile.successReaction, durationMs: 1800 });
      }

      if (payload?.image_base64) {
        await speakAssistantText(assistantText);
      }
    } catch (error) {
      setStatusText(`Ошибка генерации: ${String(error?.message || error)}`);
      setMessages((prev) => [
        ...prev,
        createMessage('assistant', `Ошибка генерации изображения: ${String(error?.message || error)}`),
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [
    authSession?.token,
    currentModel?.characterName,
    emotionProfile.successReaction,
    ensureActiveChat,
    inputText,
    loadChatById,
    modelKey,
    postToStage,
    setStatusText,
    speakAssistantText,
    syncChatList,
  ]);

  const resetChatState = useCallback(() => {
    setChatList([]);
    setMessages([]);
    setActiveChatId(null);
    setActiveChatTitle('');
    setHistoryOpen(false);
  }, []);

  return {
    activeChatId,
    activeChatTitle,
    attachedImage,
    bootstrapChats,
    chatList,
    chatLoading,
    createNewChat,
    handleAttachImageFromGallery,
    handleCloseImagePreview,
    handleDownloadPreviewImage,
    handleGenerateImage,
    handleOpenImagePreview,
    historyOpen,
    inputText,
    loadChatById,
    messages,
    previewImage,
    resetChatState,
    sendMessage,
    setAttachedImage,
    setHistoryOpen,
    setInputText,
    syncChatList,
  };
}
