import { isWeb } from './platform';

export const PANEL_WIDTH = 300;
export const PANEL_COLLAPSED = 48;

export function getWebScriptSources() {
  return {
    core: [
      '/live2d/live2dcubismcore-legacy.min.js',
      '/live2d/live2dcubismcore.min.js',
      'https://cdn.jsdelivr.net/npm/live2dcubismcore@4.2.0/dist/live2dcubismcore.min.js',
      'https://unpkg.com/live2dcubismcore@4.2.0/dist/live2dcubismcore.min.js',
    ],
    pixi: [
      '/live2d/pixi.min.js',
      'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js',
      'https://unpkg.com/pixi.js@6.5.10/dist/browser/pixi.min.js',
    ],
    live2dDisplay: [
      '/live2d/cubism4.min.js',
      'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js',
      'https://unpkg.com/pixi-live2d-display@0.4.0/dist/cubism4.min.js',
    ],
  };
}

export function getNativeScriptSources() {
  return {
    core: [
      'https://cdn.jsdelivr.net/npm/live2dcubismcore@4.2.0/dist/live2dcubismcore.min.js',
      'https://unpkg.com/live2dcubismcore@4.2.0/dist/live2dcubismcore.min.js',
      'https://cdn.jsdelivr.net/npm/live2dcubismcore/live2dcubismcore.min.js',
      'https://unpkg.com/live2dcubismcore/live2dcubismcore.min.js',
    ],
    pixi: [
      'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js',
      'https://unpkg.com/pixi.js@6.5.10/dist/browser/pixi.min.js',
    ],
    live2dDisplay: [
      'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js',
      'https://unpkg.com/pixi-live2d-display@0.4.0/dist/cubism4.min.js',
    ],
  };
}

export function getServerScriptSources(baseUrl) {
  const runtimeBase = `${baseUrl.replace(/\/$/, '')}/live2d-runtime`;
  return {
    core: [`${runtimeBase}/live2dcubismcore.min.js`],
    pixi: [`${runtimeBase}/pixi.min.js`],
    live2dDisplay: [`${runtimeBase}/cubism4.min.js`],
  };
}

export function getWebModelBase() {
  if (!isWeb || typeof window === 'undefined') return '';
  return `${window.location.origin}/live2d/model`;
}
