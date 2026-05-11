import { useEffect, useMemo, useState } from 'react';
import { defaultModelKey, live2dModels } from '../live2dModelRegistry';
import { getWebScriptSources } from './config';
import { isWeb } from './platform';
import { getRenderOrderOverride } from './renderOrderOverrides';
import { createLive2DHtml } from './template';
import { getBackendBaseUrl } from '../tts/config';

function getModelRelativePath(modelKey, fullPath) {
  const prefix = `assets/live2d/${modelKey}/`;
  if (!fullPath) return null;
  return fullPath.startsWith(prefix) ? fullPath.slice(prefix.length) : fullPath.split('/').slice(-1)[0];
}

function withEncodedPath(base, relativePath) {
  return `${base}/${relativePath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}

function withCacheBust(url, cacheKey) {
  if (!url) return url;
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}v=${encodeURIComponent(cacheKey)}`;
}

function withQuery(url, params) {
  const query = new URLSearchParams(params).toString();
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}${query}`;
}

function escapeForInjectedJavaScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function useLive2DSetup(selectedModelKey = defaultModelKey) {
  const [ready, setReady] = useState(false);
  const [html, setHtml] = useState('');
  const [nativeViewerUri, setNativeViewerUri] = useState('');
  const [nativeViewerBootstrapScript, setNativeViewerBootstrapScript] = useState('');
  const [statusText, setStatusText] = useState('Preparing assets...');

  const currentModel = useMemo(
    () => live2dModels[selectedModelKey] || live2dModels[defaultModelKey],
    [selectedModelKey]
  );
  const renderOrderOverride = useMemo(
    () => getRenderOrderOverride(currentModel?.key),
    [currentModel?.key]
  );
  const webRenderOrderOverride = isWeb ? renderOrderOverride : null;

  const costumeNames = useMemo(
    () => {
      const names = (currentModel?.expressions || [])
        .filter((exp) => exp.name.startsWith('costume_'))
        .map((exp) => exp.name);

      // Клара: показываем только стандартный + costume_v0101
      if (currentModel?.key === 'model') {
        return [];
      }

      return names;
    },
    [currentModel]
  );

  useEffect(() => {
    let alive = true;
    const cacheKey = Date.now().toString();

    async function prepareWeb() {
      const modelBase = `${window.location.origin}${currentModel.webBase}`;

      const modelJsonUrl = withEncodedPath(
        modelBase,
        getModelRelativePath(currentModel.key, currentModel.modelJsonPath)
      );
      const mocUri = withEncodedPath(
        modelBase,
        getModelRelativePath(currentModel.key, currentModel.mocPath)
      );

      const physicsRel = getModelRelativePath(currentModel.key, currentModel.physicsPath);
      const displayRel = getModelRelativePath(currentModel.key, currentModel.displayInfoPath);

      const textureUris = (currentModel.texturePaths || []).map((p) =>
        withEncodedPath(modelBase, getModelRelativePath(currentModel.key, p))
      );

      const expressions = (currentModel.expressions || []).map((exp) => ({
        fileName: exp.fileName,
        name: exp.name,
        uri: withEncodedPath(modelBase, getModelRelativePath(currentModel.key, exp.path)),
      }));

      const htmlPayload = createLive2DHtml({
        modelKey: currentModel.key,
        modelLabel: currentModel.label,
        displayScale: currentModel.displayScale || 1,
        scriptSources: getWebScriptSources(),
        modelJsonUrl,
        mocUri,
        physicsUri: physicsRel ? withEncodedPath(modelBase, physicsRel) : null,
        displayInfoUri: displayRel ? withEncodedPath(modelBase, displayRel) : null,
        textureUris,
        expressions,
        renderOrderOverride: webRenderOrderOverride,
      });

      if (!alive) return;
      setHtml(htmlPayload);
      setReady(true);
      setStatusText(`Model loaded: ${currentModel.label}`);
    }

    async function prepareNative() {
      const backendBase = getBackendBaseUrl();
      const assetsBase = `${backendBase}/app-assets/live2d/${currentModel.key}`;
      const expressions = (currentModel.expressions || []).map((exp) => ({
        name: exp.name,
        file: getModelRelativePath(currentModel.key, exp.path),
      }));
      const bootstrapScript = `(() => {
        window.__LIVE2D_STAGE_CONFIG__ = window.__LIVE2D_STAGE_CONFIG__ || {};
        window.__LIVE2D_STAGE_CONFIG__.expressions = ${escapeForInjectedJavaScript(expressions)};
        window.dispatchEvent(new Event('live2d-stage-config'));
      })();
      true;`;

      setStatusText(`Preparing ${currentModel.label}: cubism viewer...`);
      const modelJsonName = getModelRelativePath(currentModel.key, currentModel.modelJsonPath);
      const viewerUri = withCacheBust(
        withQuery(`${backendBase}/cubism-viewer/index.html`, {
          modelDir: `${assetsBase}/`,
          modelJson: modelJsonName,
          label: currentModel.label,
          displayScale: String(currentModel.displayScale || 1),
        }),
        cacheKey
      );

      if (!alive) return;
      setHtml('');
      setNativeViewerUri(viewerUri);
      setNativeViewerBootstrapScript(bootstrapScript);
      setReady(true);
      setStatusText(`Model loaded: ${currentModel.label}`);
    }

    setReady(false);
    setNativeViewerUri('');
    setNativeViewerBootstrapScript('');
    setStatusText(`Preparing ${currentModel.label}...`);

    if (currentModel?.renderer === 'lottie') {
      setHtml('');
      setNativeViewerUri('');
      setNativeViewerBootstrapScript('');
      setReady(true);
      setStatusText(`Model loaded: ${currentModel.label}`);
      return () => {
        alive = false;
      };
    }

    const task = isWeb ? prepareWeb : prepareNative;
    task().catch((error) => {
      if (!alive) return;
      setStatusText(`Asset error: ${String(error?.message || error)}`);
    });

    return () => {
      alive = false;
    };
  }, [currentModel, renderOrderOverride, webRenderOrderOverride]);

  return {
    currentModel,
    costumeNames,
    html,
    nativeViewerBootstrapScript,
    nativeViewerUri,
    ready,
    setStatusText,
    statusText,
  };
}
