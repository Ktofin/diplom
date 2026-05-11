import * as FileSystem from 'expo-file-system/legacy';

export async function uriToBase64(uri) {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export function dataUriToBase64(uri) {
  if (!uri?.startsWith('data:')) return '';
  return uri.split(',')[1] || '';
}

export function getMimeTypeFromDataUri(uri) {
  if (!uri?.startsWith('data:')) return '';
  return uri.slice(5).split(';')[0] || '';
}

function getImageExtension(mimeType) {
  switch (String(mimeType || '').toLowerCase()) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'png';
  }
}

function sanitizeFileName(fileName) {
  return String(fileName || 'generated-image').replace(/[^a-z0-9-_]+/gi, '-');
}

export async function downloadBase64Image({ base64, mimeType = 'image/png', fileName = 'generated-image' }) {
  if (!base64) {
    throw new Error('Image data is empty');
  }

  const extension = getImageExtension(mimeType);
  const resolvedFileName = `${sanitizeFileName(fileName)}.${extension}`;

  if (typeof document !== 'undefined') {
    const link = document.createElement('a');
    link.href = `data:${mimeType};base64,${base64}`;
    link.download = resolvedFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return { mode: 'web', fileName: resolvedFileName };
  }

  const targetDirectory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!targetDirectory) {
    throw new Error('File storage is unavailable on this device');
  }

  const fileUri = `${targetDirectory}${resolvedFileName}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { mode: 'native', fileUri };
}
