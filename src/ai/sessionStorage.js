import * as FileSystem from 'expo-file-system/legacy';

const SESSION_FILE_NAME = 'live2d-session.json';

function getSessionFileUri() {
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  return baseDir ? `${baseDir}${SESSION_FILE_NAME}` : null;
}

export async function loadStoredSession() {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(SESSION_FILE_NAME);
    return raw ? JSON.parse(raw) : null;
  }

  const fileUri = getSessionFileUri();
  if (!fileUri) return null;

  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists) return null;

  const raw = await FileSystem.readAsStringAsync(fileUri);
  return raw ? JSON.parse(raw) : null;
}

export async function saveStoredSession(session) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SESSION_FILE_NAME, JSON.stringify(session));
    return;
  }

  const fileUri = getSessionFileUri();
  if (!fileUri) return;

  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(session));
}

export async function clearStoredSession() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(SESSION_FILE_NAME);
    return;
  }

  const fileUri = getSessionFileUri();
  if (!fileUri) return;

  const info = await FileSystem.getInfoAsync(fileUri);
  if (info.exists) {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  }
}
