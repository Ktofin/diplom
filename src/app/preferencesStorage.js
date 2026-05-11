import * as FileSystem from 'expo-file-system/legacy';

const PREFERENCES_FILE_NAME = 'live2d-preferences.json';

function getPreferencesFileUri() {
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  return baseDir ? `${baseDir}${PREFERENCES_FILE_NAME}` : null;
}

export async function loadStoredPreferences() {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(PREFERENCES_FILE_NAME);
    return raw ? JSON.parse(raw) : null;
  }

  const fileUri = getPreferencesFileUri();
  if (!fileUri) return null;

  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists) return null;

  const raw = await FileSystem.readAsStringAsync(fileUri);
  return raw ? JSON.parse(raw) : null;
}

export async function saveStoredPreferences(preferences) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PREFERENCES_FILE_NAME, JSON.stringify(preferences));
    return;
  }

  const fileUri = getPreferencesFileUri();
  if (!fileUri) return;

  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(preferences));
}
