import { NativeModules, Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const NativeWebView = !isWeb ? require('react-native-webview').WebView : null;

export function getViewerOrigin() {
  if (isWeb) {
    return window.location.origin;
  }

  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  if (!scriptURL) {
    return null;
  }

  try {
    const normalized = scriptURL
      .replace(/^exp:\/\//i, 'http://')
      .replace(/^exps:\/\//i, 'https://');
    return new URL(normalized).origin;
  } catch {
    return null;
  }
}
