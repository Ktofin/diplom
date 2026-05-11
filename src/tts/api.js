import { getBackendBaseUrl } from './config';

async function parseJson(response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(data?.detail)
      ? data.detail.map((item) => item?.msg || JSON.stringify(item)).join('; ')
      : data?.detail || `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function fetchSpeakers() {
  const response = await fetch(`${getBackendBaseUrl()}/api/tts/speakers`);
  return parseJson(response);
}

export async function synthesizeSpeech(text, speaker) {
  const response = await fetch(`${getBackendBaseUrl()}/api/tts/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, speaker }),
  });

  return parseJson(response);
}
