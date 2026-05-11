import { isWeb } from '../live2d/platform';

export function parsePayload(rawData) {
  try {
    return typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
  } catch {
    return null;
  }
}

export function createMessage(role, content, imageUri = null, imageBase64 = null, imageMimeType = null, id = null) {
  return {
    id: id || `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    imageUri,
    imageBase64,
    imageMimeType,
  };
}

export function createImageAttachment(uri, base64 = null, mimeType = null) {
  if (!uri && !base64) return null;
  return { uri, base64, mimeType };
}

export function pickRandom(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

export function splitTextForTts(text, maxLength = 850) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  if (normalized.length <= maxLength) return [normalized];

  const sentences = normalized.split(/(?<=[.!?…])\s+/);
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if (!sentence) continue;

    if (!current) {
      current = sentence;
      continue;
    }

    if (`${current} ${sentence}`.length <= maxLength) {
      current = `${current} ${sentence}`;
      continue;
    }

    chunks.push(current);
    current = sentence;
  }

  if (current) chunks.push(current);

  return chunks.flatMap((chunk) => {
    if (chunk.length <= maxLength) return [chunk];

    const parts = [];
    let rest = chunk;

    while (rest.length > maxLength) {
      parts.push(rest.slice(0, maxLength));
      rest = rest.slice(maxLength).trim();
    }

    if (rest) parts.push(rest);
    return parts;
  });
}

export async function buildAudioFormData(uri) {
  const lowerUri = String(uri || '').toLowerCase();
  const extension = lowerUri.endsWith('.webm') ? 'webm' : lowerUri.endsWith('.wav') ? 'wav' : 'm4a';
  const type = extension === 'webm' ? 'audio/webm' : extension === 'wav' ? 'audio/wav' : 'audio/mp4';
  const formData = new FormData();

  if (isWeb) {
    const response = await fetch(uri);
    const blob = await response.blob();
    formData.append('audio', blob, `recording.${extension}`);
    return formData;
  }

  formData.append('audio', {
    uri,
    name: `recording.${extension}`,
    type,
  });
  return formData;
}

export function mapStoredMessage(message) {
  const imageUri = message.image_base64 ? `data:${message.image_mime_type || 'image/png'};base64,${message.image_base64}` : null;
  return createMessage(
    message.role,
    message.content,
    imageUri,
    message.image_base64 || null,
    message.image_mime_type || null,
    message.id
  );
}

export function buildMessagePayload(messages) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    images: message.imageBase64 ? [message.imageBase64] : [],
    image_mime_type: message.imageMimeType || null,
  }));
}
