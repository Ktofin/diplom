let bundledOverrides = {};

try {
  bundledOverrides = require('../../../pos.json');
} catch (_) {
  bundledOverrides = {};
}

export const staticRenderOrderOverrides = bundledOverrides;

const STORAGE_KEY = 'live2d-render-order-snapshots';

export function loadStoredRenderOrderSnapshot(modelKey) {
  if (!modelKey || typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed[modelKey] || null : null;
  } catch (_) {
    return null;
  }
}

export function saveStoredRenderOrderSnapshot(modelKey, snapshot) {
  if (!modelKey || !snapshot || typeof localStorage === 'undefined') {
    return;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = parsed && typeof parsed === 'object' ? parsed : {};
    next[modelKey] = snapshot;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (_) {}
}

export function getRenderOrderOverride(modelKey) {
  return staticRenderOrderOverrides[modelKey] || loadStoredRenderOrderSnapshot(modelKey) || null;
}
