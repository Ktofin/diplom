import { ActivityIndicator, Text, View } from 'react-native';
import { LottieCharacterStage } from './LottieCharacterStage';
import { getViewerOrigin, isWeb, NativeWebView } from '../live2d/platform';
import { styles } from '../styles/appStyles';

export function Live2DStage({
  html,
  iframeRef,
  modelRenderer = 'live2d',
  nativeViewerBootstrapScript,
  nativeViewerUri,
  onModelTap,
  onWebViewMessage,
  ready,
  robotState = 'idle',
  webViewRef,
}) {
  const viewerOrigin = getViewerOrigin() || 'http://localhost';

  if (modelRenderer === 'lottie') {
    return <LottieCharacterStage onPress={onModelTap} state={robotState} />;
  }

  return (
    <View style={styles.stage}>
      {ready ? (
        isWeb ? (
          <iframe
            ref={iframeRef}
            srcDoc={html}
            title="Live2D"
            style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
          />
        ) : (
          <NativeWebView
            ref={webViewRef}
            style={styles.webview}
            source={nativeViewerUri ? { uri: nativeViewerUri } : { html, baseUrl: viewerOrigin }}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            injectedJavaScriptBeforeContentLoaded={nativeViewerBootstrapScript || undefined}
            androidLayerType="hardware"
            textZoom={100}
            setBuiltInZoomControls={false}
            displayZoomControls={false}
            overScrollMode="never"
            webviewDebuggingEnabled={__DEV__}
            mixedContentMode="always"
            scrollEnabled={false}
            bounces={false}
            onLoadEnd={() => {
              if (nativeViewerBootstrapScript && webViewRef?.current?.injectJavaScript) {
                webViewRef.current.injectJavaScript(nativeViewerBootstrapScript);
              }
            }}
            onMessage={onWebViewMessage}
          />
        )
      ) : (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#5bc0be" />
          <Text style={styles.loaderText}>Подгружаю Live2D...</Text>
        </View>
      )}
    </View>
  );
}
