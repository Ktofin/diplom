import { getBackendBaseUrl } from '../tts/config';

async function parseJson(response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.detail || `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return data;
}

function buildHeaders(sessionToken, extra = {}) {
  return {
    ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    ...extra,
  };
}

export async function startAuth(name) {
  const response = await fetch(`${getBackendBaseUrl()}/api/auth/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  return parseJson(response);
}

export async function loginAuth(name, accessCode) {
  const response = await fetch(`${getBackendBaseUrl()}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, access_code: accessCode }),
  });

  return parseJson(response);
}

export async function logoutAuth(sessionToken) {
  const response = await fetch(`${getBackendBaseUrl()}/api/auth/logout`, {
    method: 'POST',
    headers: buildHeaders(sessionToken),
  });

  return parseJson(response);
}

export async function fetchProfile(sessionToken) {
  const response = await fetch(`${getBackendBaseUrl()}/api/profile`, {
    headers: buildHeaders(sessionToken),
  });

  return parseJson(response);
}

export async function updateProfile(sessionToken, name) {
  const response = await fetch(`${getBackendBaseUrl()}/api/profile`, {
    method: 'PUT',
    headers: buildHeaders(sessionToken, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ name }),
  });

  return parseJson(response);
}

export async function fetchChats(sessionToken) {
  const response = await fetch(`${getBackendBaseUrl()}/api/chats`, {
    headers: buildHeaders(sessionToken),
  });

  return parseJson(response);
}

export async function createChat(sessionToken, assistantKey, title = null) {
  const response = await fetch(`${getBackendBaseUrl()}/api/chats`, {
    method: 'POST',
    headers: buildHeaders(sessionToken, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ assistant_key: assistantKey, title }),
  });

  return parseJson(response);
}

export async function fetchChat(sessionToken, chatId) {
  const response = await fetch(`${getBackendBaseUrl()}/api/chats/${chatId}`, {
    headers: buildHeaders(sessionToken),
  });

  return parseJson(response);
}

export async function sendChat(messages, model, assistantKey, chatId, sessionToken) {
  const response = await fetch(`${getBackendBaseUrl()}/api/ai/chat`, {
    method: 'POST',
    headers: buildHeaders(sessionToken, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ messages, model, assistant_key: assistantKey, chat_id: chatId }),
  });

  return parseJson(response);
}

export async function transcribeAudio(formData, sessionToken) {
  const response = await fetch(`${getBackendBaseUrl()}/api/stt/transcribe`, {
    method: 'POST',
    headers: buildHeaders(sessionToken),
    body: formData,
  });

  return parseJson(response);
}

export async function generateImage(prompt, negativePrompt = '', chatId, assistantKey, sessionToken) {
  const response = await fetch(`${getBackendBaseUrl()}/api/images/generate`, {
    method: 'POST',
    headers: buildHeaders(sessionToken, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      prompt,
      negative_prompt: negativePrompt,
      chat_id: chatId,
      assistant_key: assistantKey,
    }),
  });

  return parseJson(response);
}
