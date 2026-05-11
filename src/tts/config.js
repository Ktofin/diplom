// src/config/api.js
import { Platform } from 'react-native';

// Публичный адрес вашего сервера (для продакшена)
const PRODUCTION_API = 'http://92.42.15.212:8002';

// Локальные адреса (для разработки)
// 10.0.2.2 — это специальный алиас для Android-эмулятора к хост-машине
// localhost — для iOS симулятора и веб-версии
const LOCAL_API_ANDROID = 'http://92.42.15.212:8002';
const LOCAL_API_OTHER = 'http://92.42.15.212:8002';

export function getBackendBaseUrl() {
  // 🔥 ГЛАВНЫЙ ФИЛЬТР: __DEV__ — это встроенная константа React Native
  // Она `true` при запуске через `expo start` / `npx expo run`, и `false` в собранном APK
  
  if (__DEV__) {
    // Режим разработки: используем локальные адреса
    if (Platform.OS === 'android') {
      return LOCAL_API_ANDROID;
    }
    return LOCAL_API_OTHER;
  }
  
  // Режим продакшена (собранный APK): всегда используем публичный сервер
  return PRODUCTION_API;
}

// Экспортируем для удобства
export const API_BASE_URL = getBackendBaseUrl();
