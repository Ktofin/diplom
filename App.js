import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter, Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AnimationDrawer } from './src/components/AnimationDrawer';
import { AccessCodeModal } from './src/components/AccessCodeModal';
import { AuthScreen } from './src/components/AuthScreen';
import { BottomNav } from './src/components/BottomNav';
import { ChatPanel } from './src/components/ChatPanel';
import { HistoryDrawer } from './src/components/HistoryDrawer';
import { ImagePreviewModal } from './src/components/ImagePreviewModal';
import { LiveCameraOverlay } from './src/components/LiveCameraOverlay';
import { Live2DStage } from './src/components/Live2DStage';
import { LottieBackground } from './src/components/LottieBackground';
import { VoiceWaveButton } from './src/components/VoiceWaveButton';
import { buildAudioFormData, createImageAttachment, parsePayload, pickRandom, splitTextForTts } from './src/app/chatHelpers';
import { requestRecordingPermission, startRecording, stopRecording } from './src/ai/recording';
import { useAuthController } from './src/hooks/useAuthController';
import { useChatController } from './src/hooks/useChatController';
import { useStoredAppPreferences } from './src/hooks/useStoredAppPreferences';
import { defaultModelKey } from './src/live2dModelRegistry';
import { isWeb } from './src/live2d/platform';
import { saveStoredRenderOrderSnapshot } from './src/live2d/renderOrderOverrides';
import { useLive2DSetup } from './src/live2d/useLive2DSetup';
import { playBase64Wav, stopAudioPlayback } from './src/tts/audio';
import { synthesizeSpeech } from './src/tts/api';
import { transcribeAudio } from './src/ai/api';
import { styles } from './src/styles/appStyles';

export default function App(initialProps) {
  const initialAssistantMode = Boolean(initialProps?.assistant_mode);
  const [backgroundKey, setBackgroundKey] = useState('default');
  const [modelKey, setModelKey] = useState(defaultModelKey);
  const [selectedCostume, setSelectedCostume] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeView, setActiveView] = useState(initialAssistantMode ? 'assistant' : 'home');
  const [assistantLaunchMode, setAssistantLaunchMode] = useState(initialAssistantMode);

  const webViewRef = useRef(null);
  const iframeRef = useRef(null);
  const recordingRef = useRef(null);
  const liveCameraRef = useRef(null);
  const costumeReplayTimeoutRef = useRef(null);

  const {
    costumeNames,
    currentModel,
    html,
    nativeViewerBootstrapScript,
    nativeViewerUri,
    ready,
    setStatusText,
    statusText,
  } = useLive2DSetup(modelKey);
  const auth = useAuthController(setStatusText);
  const emotionProfile = currentModel?.emotionProfile || {};
  const isRobotModel = currentModel?.renderer === 'lottie';
  const isCameraView = activeView === 'camera';
  const canRenderAssistantShell = assistantLaunchMode;

  const sendNativeViewerPayload = useCallback((payload) => {
    if (isWeb || isRobotModel) return;
    if (!payload || typeof payload !== 'object') return;
    if (!webViewRef.current?.injectJavaScript) return;

    const serialized = JSON.stringify(payload).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    webViewRef.current.injectJavaScript(`
      (function() {
        var payload = '${serialized}';
        try {
          document.dispatchEvent(new MessageEvent('message', { data: payload }));
        } catch (_) {}
        try {
          window.dispatchEvent(new MessageEvent('message', { data: payload }));
        } catch (_) {}
        try {
          if (window.__codexHandleStagePayload) {
            window.__codexHandleStagePayload(JSON.parse(payload));
          }
        } catch (_) {}
      })();
      true;
    `);
  }, [isRobotModel]);

  const startNativeViewerDirectLipSync = useCallback((durationMs) => {
    if (isWeb || isRobotModel) return;
    if (!webViewRef.current?.injectJavaScript) return;

    webViewRef.current.injectJavaScript(`
      (function() {
        try {
          window.__codexStartDirectLipSync && window.__codexStartDirectLipSync(${Math.max(100, Number(durationMs) || 0)});
        } catch (_) {}
      })();
      true;
    `);
  }, [isRobotModel]);

  const stopNativeViewerDirectLipSync = useCallback(() => {
    if (isWeb || isRobotModel) return;
    if (!webViewRef.current?.injectJavaScript) return;

    webViewRef.current.injectJavaScript(`
      (function() {
        try {
          window.__codexStopDirectLipSync && window.__codexStopDirectLipSync();
        } catch (_) {}
      })();
      true;
    `);
  }, [isRobotModel]);

  const applyLaunchUrl = useCallback((url) => {
    if (!url) return;

    try {
      const parsed = new URL(url);
      const isAssistantUrl =
        parsed.hostname === 'assistant' ||
        parsed.pathname === '/assistant' ||
        parsed.searchParams.get('mode') === 'assistant';

      if (isAssistantUrl) {
        setAssistantLaunchMode(true);
        setActiveView('assistant');
      }
    } catch (_) {}
  }, []);

  useStoredAppPreferences({
    backgroundKey,
    modelKey,
    selectedCostume,
    setBackgroundKey,
    setModelKey,
    setSelectedCostume,
  });

  const postToStageRaw = useCallback(
    (payload) => {
      if (isRobotModel) return;

      const serialized = JSON.stringify(payload);
      if (isWeb) {
        iframeRef.current?.contentWindow?.postMessage(serialized, '*');
        return;
      }

      webViewRef.current?.postMessage(serialized);
    },
    [isRobotModel]
  );

  const postToStage = useCallback(
    (payload) => {
      postToStageRaw(payload);

      if (!selectedCostume) return;
      if (!payload || typeof payload !== 'object') return;
      if (!['setMood', 'triggerReaction', 'playExpression'].includes(payload.type)) return;

      if (costumeReplayTimeoutRef.current) {
        clearTimeout(costumeReplayTimeoutRef.current);
      }

      let replayDelayMs = null;

      if (payload.type === 'triggerReaction' || payload.type === 'playExpression') {
        replayDelayMs = Math.max(300, Number(payload.durationMs) || 2200);
      } else if (payload.type === 'setMood' && !payload.name) {
        replayDelayMs = 40;
      }

      if (replayDelayMs == null) return;

      costumeReplayTimeoutRef.current = setTimeout(() => {
        postToStageRaw({ type: 'setCostume', name: selectedCostume });
      }, replayDelayMs);
    },
    [postToStageRaw, selectedCostume]
  );

  const speakAssistantText = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const speaker = currentModel?.ttsSpeaker || 'kseniya';
      const chunks = splitTextForTts(trimmed);
      setIsSpeaking(true);

      try {
        for (let index = 0; index < chunks.length; index += 1) {
          const payload = await synthesizeSpeech(chunks[index], speaker);
          if (!isRobotModel) {
            const lipSyncDurationMs = Math.max(
              1200,
              Array.isArray(payload.mouth_cues) && payload.mouth_cues.length > 0
                ? payload.mouth_cues.length * (payload.cue_interval_ms || 50)
                : chunks[index].length * 90
            );
            const lipSyncTestPayload = {
              type: 'lipSyncTest',
              durationMs: lipSyncDurationMs,
            };
            const lipSyncSequencePayload = {
              type: 'playLipSyncSequence',
              cues: payload.mouth_cues || [],
              cueIntervalMs: payload.cue_interval_ms || 50,
            };

            postToStage(lipSyncTestPayload);
            sendNativeViewerPayload(lipSyncTestPayload);
            postToStage(lipSyncSequencePayload);
            sendNativeViewerPayload(lipSyncSequencePayload);
            startNativeViewerDirectLipSync(lipSyncDurationMs + 250);
          }

          await playBase64Wav(payload.audio_base64, () => {
            stopNativeViewerDirectLipSync();
            if (index === chunks.length - 1) {
              setStatusText(`${currentModel?.characterName || 'AI'} закончил${currentModel?.gender === 'female' ? 'а' : ''} говорить`);
            }
          });
        }
      } finally {
        stopNativeViewerDirectLipSync();
        setIsSpeaking(false);
      }
    },
    [currentModel?.characterName, currentModel?.gender, currentModel?.ttsSpeaker, isRobotModel, postToStage, sendNativeViewerPayload, setStatusText, startNativeViewerDirectLipSync, stopNativeViewerDirectLipSync]
  );

  const chat = useChatController({
    authSession: auth.authSession,
    currentModel,
    emotionProfile,
    modelKey,
    postToStage,
    setActiveView,
    setModelKey,
    setStatusText,
    speakAssistantText,
  });
  const robotState = isRobotModel ? (isSpeaking ? 'speaking' : chat.chatLoading ? 'thinking' : 'idle') : 'idle';

  useEffect(() => {
    if (selectedCostume == null) return;
    if (costumeNames.includes(selectedCostume)) return;
    setSelectedCostume(null);
  }, [costumeNames, selectedCostume]);

  useEffect(() => {
    if (isRobotModel || !ready) return;
    postToStage({ type: 'setCostume', name: selectedCostume || null });
  }, [isRobotModel, postToStage, ready, selectedCostume]);

  useEffect(() => {
    return () => {
      stopAudioPlayback().catch(() => undefined);
      if (costumeReplayTimeoutRef.current) {
        clearTimeout(costumeReplayTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let active = true;

    Linking.getInitialURL()
      .then((url) => {
        if (active) {
          applyLaunchUrl(url);
        }
      })
      .catch(() => undefined);

    const linkingSubscription = Linking.addEventListener('url', (event) => {
      applyLaunchUrl(event?.url);
    });

    const assistantSubscription = DeviceEventEmitter?.addListener?.('onAssistantModeChanged', (payload) => {
      if (payload?.assistant_mode) {
        setAssistantLaunchMode(true);
        setActiveView('assistant');
      }
    });

    return () => {
      active = false;
      linkingSubscription?.remove?.();
      assistantSubscription?.remove?.();
    };
  }, [applyLaunchUrl]);

  useEffect(() => {
    if (!auth.authReady || !auth.authSession?.token) return;
    if (auth.initializedSessionTokenRef.current === auth.authSession.token) return;

    auth.initializedSessionTokenRef.current = auth.authSession.token;

    auth.loadProfile(auth.authSession).catch((error) => {
      setStatusText(`Ошибка профиля: ${String(error?.message || error)}`);
    });

    chat.bootstrapChats(auth.authSession).catch((error) => {
      setStatusText(`Ошибка чатов: ${String(error?.message || error)}`);
    });
  }, [auth.authReady, auth.authSession?.token]);

  useEffect(() => {
    if (isRobotModel) return undefined;

    if (chat.chatLoading) {
      postToStage({ type: 'setMood', name: emotionProfile.thinkingMood || null });
      return undefined;
    }

    if (isSpeaking) {
      postToStage({ type: 'setMood', name: emotionProfile.speakingMood || null });
      return undefined;
    }

    postToStage({ type: 'setMood', name: null });
    return undefined;
  }, [chat.chatLoading, emotionProfile.speakingMood, emotionProfile.thinkingMood, isRobotModel, isSpeaking, postToStage]);

  const onEmbeddedMessage = useCallback(
    (rawData) => {
      const payload = parsePayload(rawData);
      if (payload?.type === 'status' && payload?.text) {
        setStatusText(payload.text);
        return;
      }

      if (payload?.type === 'renderOrderSnapshot' && payload?.modelKey && payload?.snapshot) {
        saveStoredRenderOrderSnapshot(payload.modelKey, payload.snapshot);
        if (typeof console !== 'undefined' && console.log) {
          console.log('[Live2D renderOrderSnapshot]', payload.modelKey, payload.snapshot);
        }
        setStatusText(`Снимок слоёв сохранён: ${payload.modelKey}`);
        return;
      }

      if (payload?.type === 'modelTapped') {
        const reaction = pickRandom(emotionProfile.tapReactions);
        if (reaction) {
          postToStage({ type: 'triggerReaction', name: reaction, durationMs: 2200 });
        }
      }
    },
    [emotionProfile.tapReactions, postToStage, setStatusText]
  );

  useEffect(() => {
    if (!isWeb || isRobotModel) return undefined;

    const handle = (event) => onEmbeddedMessage(event.data);
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, [isRobotModel, onEmbeddedMessage]);

  const handleRobotTap = useCallback(() => {
    if (!isRobotModel) return;
    setStatusText('Вася на связи');
  }, [isRobotModel, setStatusText]);

  const handleSelectView = useCallback((nextView) => {
    setAssistantLaunchMode(false);
    setActiveView((currentView) => (currentView === nextView ? 'home' : nextView));
  }, []);

  const handleExitAssistant = useCallback(() => {
    setAssistantLaunchMode(false);
    setActiveView('home');
  }, []);

  const requireAssistantLogin = useCallback(() => {
    if (auth.authSession?.token) {
      return true;
    }

    setStatusText(auth.authReady ? 'Войдите, пожалуйста, в приложение' : 'Подождите, восстанавливаю сессию');
    return false;
  }, [auth.authReady, auth.authSession?.token, setStatusText]);

  const sendCostume = useCallback(
    (name) => {
      setSelectedCostume(name);
      postToStage({ type: 'setCostume', name });
    },
    [postToStage]
  );

  const handleSelectModel = useCallback(
    async (nextModelKey) => {
      setModelKey(nextModelKey);
      if (!auth.authSession?.token || nextModelKey === modelKey) {
        return;
      }

      await chat.createNewChat(nextModelKey, auth.authSession);
    },
    [auth.authSession, chat, modelKey]
  );

  const captureLiveCameraImage = useCallback(async () => {
    if (!liveCameraRef.current?.takePictureAsync) return null;

    const photo = await liveCameraRef.current.takePictureAsync({
      base64: true,
      quality: 0.7,
      shutterSound: false,
    });

    return createImageAttachment(photo?.uri || null, photo?.base64 || null, 'image/jpeg');
  }, []);

  const handleLogout = useCallback(async () => {
    chat.resetChatState();
    await auth.handleLogout();
  }, [auth, chat]);

  const handleAssistantSend = useCallback(async () => {
    if (!requireAssistantLogin()) {
      return;
    }

    await chat.sendMessage();
  }, [chat, requireAssistantLogin]);

  const handleToggleRecording = useCallback(async () => {
    try {
      if (assistantLaunchMode && !isRecording && !requireAssistantLogin()) {
        return;
      }

      if (isRecording) {
        setIsRecording(false);
        setStatusText('Обрабатываю запись...');
        const uri = await stopRecording(recordingRef.current);
        recordingRef.current = null;

        if (!uri) {
          setStatusText('Не удалось получить аудио');
          return;
        }

        const transcript = await transcribeAudio(await buildAudioFormData(uri), auth.authSession?.token);
        const text = transcript?.text?.trim();
        if (!text) {
          setStatusText('Не удалось распознать речь');
          return;
        }

        const cameraImage = isCameraView ? await captureLiveCameraImage().catch(() => null) : null;
        setStatusText(`Распознано: ${text}`);
        await chat.sendMessage(text, cameraImage);
        return;
      }

      const granted = await requestRecordingPermission();
      if (!granted) {
        setStatusText('Нет доступа к микрофону');
        return;
      }

      recordingRef.current = await startRecording();
      setIsRecording(true);
      setStatusText(isCameraView ? 'Говори и показывай в камеру' : 'Идёт запись голосового вопроса');
    } catch (error) {
      setIsRecording(false);
      recordingRef.current = null;
      setStatusText(`Ошибка записи: ${String(error?.message || error)}`);
    }
  }, [assistantLaunchMode, auth.authSession?.token, captureLiveCameraImage, chat, isCameraView, isRecording, requireAssistantLogin, setStatusText]);

  const renderForeground = () => {
    if (activeView === 'assistant') {
      return (
        <View style={styles.assistantScreen}>
          <View style={styles.assistantCardShell}>
            <View style={styles.assistantPanel}>
              <View style={styles.assistantTopBar}>
                <View style={styles.assistantTopText}>
                  <Text style={styles.assistantTitle}>{currentModel?.characterName || 'Ассистент'}</Text>
                  <Text style={styles.assistantSubtitle}>Говори, пиши и при необходимости сразу включай камеру.</Text>
                </View>
                <View style={styles.assistantActionRow}>
                  <Pressable
                    style={[styles.assistantActionButton, styles.assistantActionButtonPrimary]}
                    onPress={() => setActiveView('camera')}
                  >
                    <Text style={[styles.assistantActionButtonText, styles.assistantActionButtonTextPrimary]}>Камера</Text>
                  </Pressable>
                  <Pressable style={styles.assistantActionButton} onPress={handleExitAssistant}>
                    <Text style={styles.assistantActionButtonText}>Закрыть</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.assistantChatWrap}>
                <ChatPanel
                  attachedImageUri={chat.attachedImage?.uri || null}
                  assistantName={currentModel?.characterName || 'AI'}
                  chatLoading={chat.chatLoading}
                  chatTitle={chat.activeChatTitle || 'Ассистент'}
                  headerTitle="Ассистент"
                  inputText={chat.inputText}
                  messages={chat.messages}
                  onAttachImage={chat.handleAttachImageFromGallery}
                  onChangeText={chat.setInputText}
                  onClearImage={() => chat.setAttachedImage(null)}
                  onGenerateImage={chat.handleGenerateImage}
                  onOpenHistory={() => chat.setHistoryOpen(true)}
                  onPressImage={chat.handleOpenImagePreview}
                  onSend={handleAssistantSend}
                  showAttachButton={false}
                  showGenerateButton={false}
                  showHistoryButton={false}
                  subtitle={auth.authSession ? 'Мини-чат текущего помощника.' : 'Для отправки сообщений сначала войдите в приложение.'}
                />
              </View>

              <View style={styles.assistantVoiceDock}>
                <VoiceWaveButton
                  isRecording={isRecording}
                  label={isRecording ? 'Идёт запись запроса' : 'Нажми и говори'}
                  onPress={handleToggleRecording}
                />
              </View>
            </View>
          </View>
        </View>
      );
    }

    if (activeView === 'chat') {
      return (
        <View style={styles.foregroundScreen}>
          <ChatPanel
            attachedImageUri={chat.attachedImage?.uri || null}
            assistantName={currentModel?.characterName || 'AI'}
            chatLoading={chat.chatLoading}
            chatTitle={chat.activeChatTitle}
            inputText={chat.inputText}
            messages={chat.messages}
            onAttachImage={chat.handleAttachImageFromGallery}
            onChangeText={chat.setInputText}
            onClearImage={() => chat.setAttachedImage(null)}
            onGenerateImage={chat.handleGenerateImage}
            onOpenHistory={() => chat.setHistoryOpen(true)}
            onPressImage={chat.handleOpenImagePreview}
            onSend={() => chat.sendMessage()}
          />
        </View>
      );
    }

    if (activeView === 'camera') {
      return (
        <LiveCameraOverlay
          cameraRef={liveCameraRef}
          isRecording={isRecording}
          onToggleRecording={handleToggleRecording}
          topContent={
            assistantLaunchMode ? (
              <View style={styles.assistantCameraTopBar}>
                <Pressable style={styles.assistantActionButton} onPress={() => setActiveView('assistant')}>
                  <Text style={styles.assistantActionButtonText}>Назад</Text>
                </Pressable>
                <Pressable style={styles.assistantActionButton} onPress={handleExitAssistant}>
                  <Text style={styles.assistantActionButtonText}>Закрыть</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      );
    }

    if (activeView === 'settings') {
      return (
        <View style={styles.foregroundScreen}>
          <AnimationDrawer
            authSession={auth.authSession}
            costumeNames={costumeNames}
            currentBackground={backgroundKey}
            currentCostume={selectedCostume}
            currentModel={modelKey}
            onBackgroundSelect={setBackgroundKey}
            onChangeProfileName={auth.setProfileName}
            onCostumeSelect={sendCostume}
            onLogout={handleLogout}
            onModelSelect={handleSelectModel}
            onSaveProfile={auth.handleSaveProfile}
            profileLoading={auth.profileLoading}
            profileName={auth.profileName}
          />
        </View>
      );
    }

    return (
      <View style={styles.homeVoiceDock}>
        <VoiceWaveButton isRecording={isRecording} onPress={handleToggleRecording} />
      </View>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <LottieBackground backgroundKey={backgroundKey} />

        <View style={styles.stageShell}>
          <Live2DStage
            html={html}
            iframeRef={iframeRef}
            modelRenderer={currentModel?.renderer || 'live2d'}
            nativeViewerBootstrapScript={nativeViewerBootstrapScript}
            nativeViewerUri={nativeViewerUri}
            onModelTap={handleRobotTap}
            onWebViewMessage={(event) => onEmbeddedMessage(event?.nativeEvent?.data)}
            ready={ready}
            robotState={robotState}
            statusText={statusText}
            webViewRef={webViewRef}
          />
        </View>

        {(auth.authReady || canRenderAssistantShell) && (auth.authSession || canRenderAssistantShell) ? renderForeground() : null}

        {auth.authReady && auth.authSession && !assistantLaunchMode ? <BottomNav activeView={activeView} onSelect={handleSelectView} /> : null}
        {auth.authReady && !auth.authSession && !assistantLaunchMode ? (
          <AuthScreen
            authCode={auth.authCode}
            authLoading={auth.authLoading}
            authMode={auth.authMode}
            authName={auth.authName}
            onChangeAuthCode={auth.setAuthCode}
            onChangeAuthName={auth.setAuthName}
            onLogin={auth.handleAuthLogin}
            onSetMode={auth.setAuthMode}
            onStart={auth.handleAuthStart}
          />
        ) : null}

        <HistoryDrawer
          activeChatId={chat.activeChatId}
          chatList={chat.chatList}
          historyOpen={chat.historyOpen}
          modelKey={modelKey}
          onClose={() => chat.setHistoryOpen(false)}
          onCreateChat={chat.createNewChat}
          onLoadChat={(chatId) => chat.loadChatById(chatId).catch((error) => setStatusText(`Ошибка истории: ${String(error?.message || error)}`))}
          onSelectAssistant={setModelKey}
        />

        <ImagePreviewModal image={chat.previewImage} onClose={chat.handleCloseImagePreview} onDownload={chat.handleDownloadPreviewImage} />
        <AccessCodeModal accessCode={auth.issuedAccessCode} onClose={() => auth.setIssuedAccessCode('')} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
