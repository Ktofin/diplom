import { isWeb } from './platform';

export function absolutizeWebUri(uri) {
  if (!isWeb || !uri) return uri;
  if (/^https?:\/\//i.test(uri) || uri.startsWith('blob:') || uri.startsWith('data:')) {
    return uri;
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (uri.startsWith('/')) {
    return `${origin}${uri}`;
  }

  return new URL(uri, `${origin}/`).href;
}
