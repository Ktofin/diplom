export function createLive2DHtml(config) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: transparent;
      }
      #app {
        width: 100%;
        height: 100%;
        touch-action: none;
      }
      #status {
        position: fixed;
        left: 10px;
        top: 10px;
        display: none;
        padding: 6px 10px;
        background: rgba(0, 0, 0, 0.42);
        color: #fff;
        font: 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        border-radius: 8px;
        z-index: 10;
      }
    </style>
  </head>
  <body>
    <div id="status">Loading Live2D...</div>
    <div id="app"></div>

    <script>
      const cfg = ${JSON.stringify(config)};
      const statusEl = document.getElementById('status');
      const appRoot = document.getElementById('app');

      let app;
      let model;
      let lipSyncTicker = null;
      let lipSyncStartedAt = 0;
      let lipSyncMode = null;
      let lipSyncCues = [];
      let lipSyncCueIntervalMs = 50;
      let mouthParamIndex = -1;
      let mouthParamId = null;
      let expressionTicker = null;
      let activeMoodExpression = null;
      let activeOverlayExpression = null;
      let overlayExpiresAt = 0;
      let activeCostume = null;
      let baseParameters = null;
      let viewResizeHandler = null;
      let fetchDebugWrapped = false;
      const expressionCache = new Map();
      const LIVE2D_RENDERER_PREMULTIPLIED_ALPHA_FIX = false;

      function isAndroidUserAgent() {
        return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
      }

      function getViewDimensions() {
        const vv = window.visualViewport;
        const w = vv && vv.width > 0 ? vv.width : window.innerWidth;
        const h = vv && vv.height > 0 ? vv.height : window.innerHeight;
        return {
          width: Math.max(1, Math.floor(w)),
          height: Math.max(1, Math.floor(h)),
        };
      }

      function getPixiResolution() {
        const dpr = window.devicePixelRatio || 1;
        if (!isAndroidUserAgent()) {
          return dpr;
        }
        return Math.min(Math.max(dpr, 1), 2);
      }

      function applyPixiHostSettings() {
        if (window.PIXI && PIXI.settings) {
          PIXI.settings.FAIL_IF_MAJOR_PERFORMANCE_CAVEAT = false;
          PIXI.settings.SPRITE_MAX_TEXTURES = 16;
          PIXI.settings.CAN_UPLOAD_SAME_BUFFER = true;
        }
        try {
          if (window.PIXI && PIXI.live2d && PIXI.live2d.settings) {
            PIXI.live2d.settings.sortMode = 'backToFront';
          }
        } catch (_) {}
      }

      function postFetchDebug(payload) {
        const msg = JSON.stringify(payload);
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(msg);
        } else if (window.parent && window.parent !== window) {
          window.parent.postMessage(msg, '*');
        }
      }

      function ensureFetchDebugWrapper() {
        if (fetchDebugWrapped || typeof window.fetch !== 'function') return;
        fetchDebugWrapped = true;
        const originalFetch = window.fetch.bind(window);
        window.fetch = function (...args) {
          const url = args[0];
          const urlStr =
            typeof url === 'string'
              ? url
              : url && typeof url === 'object' && 'url' in url
                ? String(url.url)
                : String(url);
          return originalFetch.apply(window, args).catch((err) => {
            postFetchDebug({ type: 'fetchError', url: urlStr, error: String(err) });
            throw err;
          });
        };
      }

      function whenBaseTextureReady(baseTexture) {
        if (!baseTexture) return Promise.resolve();
        return new Promise((resolve) => {
          try {
            if (baseTexture.valid) {
              resolve();
              return;
            }
          } catch (_) {}
          const done = () => resolve();
          baseTexture.once('loaded', done);
          baseTexture.once('error', done);
        });
      }

      async function waitLive2dModelTexturesReady(live2dModel) {
        const textures = live2dModel && live2dModel.textures ? live2dModel.textures : [];
        await Promise.all(textures.map((tex) => whenBaseTextureReady(tex && tex.baseTexture)));
      }

      function describeError(error) {
        if (!error) return 'unknown';
        if (typeof error === 'string') return error;
        if (error?.type === 'error' && error?.target?.src) {
          return 'Failed to load script: ' + error.target.src;
        }
        const parts = [];
        if (error.message) parts.push(error.message);
        if (error.reason?.message) parts.push(error.reason.message);
        if (error.filename) parts.push('file=' + error.filename);
        if (error.lineno) parts.push('line=' + error.lineno);
        if (error.colno) parts.push('col=' + error.colno);
        if (error.stack) parts.push(error.stack);
        if (error.reason?.stack) parts.push(error.reason.stack);
        if (parts.length === 0) {
          parts.push(String(error.reason || error));
        }
        return parts.join(' | ');
      }

      function setStatus(text) {
        if (!statusEl) return;
        statusEl.textContent = text;
        const msg = JSON.stringify({ type: 'status', text: String(text) });
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(msg);
        } else if (window.parent && window.parent !== window) {
          window.parent.postMessage(msg, '*');
        }
      }

      function postPayload(payload) {
        const msg = JSON.stringify(payload);
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(msg);
        } else if (window.parent && window.parent !== window) {
          window.parent.postMessage(msg, '*');
        }
      }

      function emitRenderOrderSnapshot(targetModel) {
        const coreModel = targetModel && targetModel.internalModel && targetModel.internalModel.coreModel;
        if (!coreModel) return;

        try {
          const drawableCount =
            typeof coreModel.getDrawableCount === 'function' ? Number(coreModel.getDrawableCount()) || 0 : 0;
          const drawableIds = [];
          const renderOrders = [];

          for (let index = 0; index < drawableCount; index += 1) {
            drawableIds.push(String(coreModel.getDrawableId?.(index) || ''));
            renderOrders.push(Number(coreModel.getDrawableRenderOrders?.()[index]));
          }

          postPayload({
            type: 'renderOrderSnapshot',
            modelKey: cfg.modelKey || null,
            snapshot: {
              drawableIds,
              renderOrders,
            },
          });
        } catch (_) {}
      }

      function fitModel() {
        if (!model || !app) return;

        const core = model.internalModel && model.internalModel.coreModel;
        if (!core) return;
        if (typeof core.getDrawableCount === 'function') {
          const drawableCount = core.getDrawableCount();
          if (drawableCount <= 0) return;
        }

        model.anchor.set(0.5, 0.5);
        model.x = app.screen.width / 2;
        model.y = app.screen.height / 2;

        const bounds = model.getLocalBounds();
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;

        const targetH = app.screen.height * 0.86;
        const targetW = app.screen.width * 0.78;
        const baseScale = Math.min(targetW / bounds.width, targetH / bounds.height);
        const scaleMultiplier = Math.max(0.1, Number(cfg.displayScale) || 1);
        const scale = baseScale * scaleMultiplier;

        if (scale > 0 && Number.isFinite(scale)) {
          model.scale.set(scale);
        }
      }

      function scheduleFitAfterModelLoad() {
        fitModel();
        requestAnimationFrame(() => {
          fitModel();
          requestAnimationFrame(() => fitModel());
        });
        setTimeout(fitModel, 150);
        if (model && typeof model.once === 'function') {
          const refit = () => fitModel();
          model.once('textureLoaded', refit);
          model.once('ready', refit);
        }
      }

      function syncPixiViewToWindow() {
        if (!app) return;
        const next = getViewDimensions();
        const res = getPixiResolution();
        app.view.width = next.width * res;
        app.view.height = next.height * res;
        app.renderer.resize(next.width, next.height);
        app.renderer.resolution = res;
      }

      function detachViewResize() {
        if (!viewResizeHandler) return;
        window.removeEventListener('resize', viewResizeHandler);
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', viewResizeHandler);
        }
        viewResizeHandler = null;
      }

      function attachViewResize() {
        detachViewResize();
        viewResizeHandler = () => {
          syncPixiViewToWindow();
          fitModel();
        };
        window.addEventListener('resize', viewResizeHandler);
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', viewResizeHandler);
        }
      }

      function disableRendererMasking() {
        const internalModel = model?.internalModel;
        const renderer = internalModel?.renderer;
        const coreModel = internalModel?.coreModel;
        if (!renderer || !coreModel) return false;

        try {
          const clippingManager = renderer._clippingManager;
          if (clippingManager) {
            clippingManager.setGL = () => {};
            clippingManager.setupClippingContext = () => {};
            clippingManager.calcClippedDrawTotalBounds = () => {};
            clippingManager._clippingContextListForDraw = [];
            clippingManager._clippingContextListForMask = [];
          }

          if (typeof coreModel.isUsingMasking === 'function') {
            coreModel.isUsingMasking = () => false;
          }

          if (typeof coreModel.getDrawableMasks === 'function') {
            coreModel.getDrawableMasks = () => [];
          }

          if (typeof coreModel.getDrawableMaskCounts === 'function') {
            const drawableCount =
              typeof coreModel.getDrawableCount === 'function' ? Number(coreModel.getDrawableCount()) || 0 : 0;
            const zeroMaskCounts = new Array(drawableCount).fill(0);
            coreModel.getDrawableMaskCounts = () => zeroMaskCounts;
          }

          setStatus('Masking disabled fallback applied');
          return true;
        } catch (error) {
          setStatus('Masking fallback error: ' + describeError(error));
          return false;
        }
      }

      function installRendererFallbacks() {
        const renderer = model?.internalModel?.renderer;
        if (!renderer || renderer.__fallbackInstalled) return;

        renderer.__fallbackInstalled = true;
        const specialDrawablePrefixes =
          cfg.modelKey === 'model' ? ['e', 'v0052', 'v0100', 'v0101'] : [];

        function extractExpressionPrefixes(expressionData) {
          const prefixes = new Set();
          const parameters = expressionData?.Parameters;
          if (!Array.isArray(parameters)) {
            return prefixes;
          }

          for (const parameter of parameters) {
            const id = String(parameter?.Id || '').trim();
            if (!id) continue;

            const normalized = id.toLowerCase();
            const prefixMatch = normalized.match(/^([a-z0-9]+?)(?:_?param)/i);
            if (!prefixMatch?.[1]) continue;

            const prefix = prefixMatch[1].toLowerCase();
            if (specialDrawablePrefixes.includes(prefix)) {
              prefixes.add(prefix);
            }
          }

          return prefixes;
        }

        function getActiveDrawablePrefixes() {
          const prefixes = new Set();

          if (cfg.modelKey === 'model') {
            prefixes.add('v0000');
          }

          for (const prefix of extractExpressionPrefixes(activeCostume)) {
            prefixes.add(prefix);
          }
          for (const prefix of extractExpressionPrefixes(activeMoodExpression)) {
            prefixes.add(prefix);
          }
          for (const prefix of extractExpressionPrefixes(activeOverlayExpression)) {
            prefixes.add(prefix);
          }

          return prefixes;
        }

        function shouldSkipSpecialDrawable(drawableId, activePrefixes, useSpecialFilter) {
          if (!useSpecialFilter || !drawableId || specialDrawablePrefixes.length === 0) {
            return false;
          }

          const normalizedId = String(drawableId).toLowerCase();
          const matchedPrefix = specialDrawablePrefixes.find((prefix) => normalizedId.startsWith(prefix));
          if (!matchedPrefix) {
            return false;
          }

          return !activePrefixes.has(matchedPrefix);
        }

        renderer.doDrawModel = function () {
          const live2dModel = this.getModel?.();
          if (!live2dModel) {
            throw new Error('Renderer model is unavailable');
          }

          const drawableCount = Number(live2dModel.getDrawableCount?.()) || 0;
          const renderOrders = live2dModel.getDrawableRenderOrders?.();
          let drawnCount = 0;
          let skippedCount = 0;
          let invalidOrderCount = 0;
          let invisibleCount = 0;
          let missingMeshCount = 0;
          let drawErrorCount = 0;
          const shouldIgnoreVisibility =
            Array.isArray(renderOrders) ? false : true;
          const activePrefixes = getActiveDrawablePrefixes();
          if (!Array.isArray(this._sortedDrawableIndexList)) {
            this._sortedDrawableIndexList = new Array(drawableCount).fill(-1);
          } else if (this._sortedDrawableIndexList.length !== drawableCount) {
            this._sortedDrawableIndexList = new Array(drawableCount).fill(-1);
          } else {
            this._sortedDrawableIndexList.fill(-1);
          }

          this.preDraw?.();

          try {
            if (this._clippingManager) {
              this._clippingManager.setupClippingContext?.(live2dModel, this);
            }
          } catch (_) {}

          for (let drawableIndex = 0; drawableIndex < drawableCount; drawableIndex += 1) {
            const renderOrder = Number(renderOrders?.[drawableIndex]);
            if (Number.isInteger(renderOrder) && renderOrder >= 0 && renderOrder < drawableCount) {
              this._sortedDrawableIndexList[renderOrder] = drawableIndex;
            } else {
              invalidOrderCount += 1;
              this._sortedDrawableIndexList[drawableIndex] = drawableIndex;
            }
          }

          for (let orderIndex = 0; orderIndex < drawableCount; orderIndex += 1) {
            const drawableIndex = this._sortedDrawableIndexList[orderIndex];
            if (!Number.isInteger(drawableIndex) || drawableIndex < 0 || drawableIndex >= drawableCount) {
              skippedCount += 1;
              continue;
            }

            try {
              const isVisible = Boolean(live2dModel.getDrawableDynamicFlagIsVisible?.(drawableIndex));
              const opacity = Number(live2dModel.getDrawableOpacity?.(drawableIndex)) || 0;
              const drawableId = String(live2dModel.getDrawableId?.(drawableIndex) || '');
              const useSpecialFilter = invalidOrderCount >= drawableCount;
              if (opacity <= 0.001) {
                invisibleCount += 1;
                continue;
              }

              if (shouldSkipSpecialDrawable(drawableId, activePrefixes, useSpecialFilter)) {
                invisibleCount += 1;
                continue;
              }

              if (!isVisible && !shouldIgnoreVisibility && invalidOrderCount < drawableCount) {
                invisibleCount += 1;
                continue;
              }

              const clippingContexts = this._clippingManager?.getClippingContextListForDraw?.();
              this.setClippingContextBufferForDraw?.(
                Array.isArray(clippingContexts) ? clippingContexts[drawableIndex] ?? null : null
              );
              this.setIsCulling?.(Boolean(live2dModel.getDrawableCulling?.(drawableIndex)));

              const textureIndex = Number(live2dModel.getDrawableTextureIndices?.(drawableIndex));
              const vertexIndexCount = Number(live2dModel.getDrawableVertexIndexCount?.(drawableIndex)) || 0;
              const vertexCount = Number(live2dModel.getDrawableVertexCount?.(drawableIndex)) || 0;
              const vertexIndices = live2dModel.getDrawableVertexIndices?.(drawableIndex);
              const vertices = live2dModel.getDrawableVertices?.(drawableIndex);
              const uvs = live2dModel.getDrawableVertexUvs?.(drawableIndex);

              if (
                !Number.isInteger(textureIndex) ||
                textureIndex < 0 ||
                vertexIndexCount <= 0 ||
                vertexCount <= 0 ||
                !vertexIndices ||
                !vertices ||
                !uvs
              ) {
                missingMeshCount += 1;
                continue;
              }

              this.drawMesh?.(
                textureIndex,
                vertexIndexCount,
                vertexCount,
                vertexIndices,
                vertices,
                uvs,
                opacity,
                live2dModel.getDrawableBlendMode?.(drawableIndex),
                Boolean(live2dModel.getDrawableInvertedMaskBit?.(drawableIndex))
              );
              drawnCount += 1;
            } catch (_) {
              drawErrorCount += 1;
              try {
                disableRendererMasking();
              } catch (_) {}
              continue;
            }
          }

          if (!renderer.__lastDrawReport || performance.now() - renderer.__lastDrawReportAt > 1500) {
            renderer.__lastDrawReport = true;
            renderer.__lastDrawReportAt = performance.now();
            setStatus(
              'Draw report: drawn=' +
                drawnCount +
                ' skipped=' +
                skippedCount +
                ' invisible=' +
                invisibleCount +
                ' invalidOrder=' +
                invalidOrderCount +
                ' active=' +
                Array.from(activePrefixes).sort().join(',') +
                ' missingMesh=' +
                missingMeshCount +
                ' drawErrors=' +
                drawErrorCount
            );
          }
        };
      }

      function snapshotBaseParameters() {
        const coreModel = model?.internalModel?.coreModel;
        if (!coreModel) return;

        try {
          if (typeof coreModel.getParameterCount !== 'function' || typeof coreModel.getParameterValueByIndex !== 'function') {
            return;
          }

          const count = coreModel.getParameterCount();
          baseParameters = new Array(count);

          for (let i = 0; i < count; i += 1) {
            baseParameters[i] = coreModel.getParameterValueByIndex(i);
          }
        } catch (_) {
          baseParameters = null;
        }
      }

      function restoreBaseParameters() {
        const coreModel = model?.internalModel?.coreModel;
        if (!coreModel || !baseParameters) return;

        try {
          if (typeof coreModel.setParameterValueByIndex !== 'function') return;

          for (let i = 0; i < baseParameters.length; i += 1) {
            coreModel.setParameterValueByIndex(i, baseParameters[i], 1);
          }
        } catch (_) {}
      }

      function reportRenderDiagnostics() {
        const coreModel = model?.internalModel?.coreModel;
        if (!coreModel) return;

        try {
          const drawableCount = Number(coreModel.getDrawableCount?.()) || 0;
          let visibleCount = 0;
          let nonZeroOpacityCount = 0;
          const sample = [];

          for (let index = 0; index < drawableCount; index += 1) {
            const isVisible = Boolean(coreModel.getDrawableDynamicFlagIsVisible?.(index));
            const opacity = Number(coreModel.getDrawableOpacity?.(index)) || 0;
            const id = String(coreModel.getDrawableId?.(index) || '');

            if (isVisible) visibleCount += 1;
            if (opacity > 0.001) nonZeroOpacityCount += 1;
            if (sample.length < 8 && (isVisible || opacity > 0.001)) {
              sample.push(id || ('#' + index));
            }
          }

          const partCount = Number(coreModel.getPartCount?.()) || 0;
          let nonZeroPartOpacityCount = 0;
          for (let index = 0; index < partCount; index += 1) {
            const partOpacity = Number(coreModel.getPartOpacityByIndex?.(index)) || 0;
            if (partOpacity > 0.001) nonZeroPartOpacityCount += 1;
          }

          setStatus(
            'Render debug: drawables=' +
              drawableCount +
              ' visible=' +
              visibleCount +
              ' opacity>0=' +
              nonZeroOpacityCount +
              ' parts=' +
              partCount +
              ' partOpacity>0=' +
              nonZeroPartOpacityCount +
              ' sample=' +
              sample.join(',')
          );
        } catch (error) {
          setStatus('Render debug error: ' + describeError(error));
        }
      }

      function applyExpressionParameters(expressionData) {
        const coreModel = model?.internalModel?.coreModel;
        const parameters = expressionData?.Parameters;
        if (!coreModel || !Array.isArray(parameters)) return;

        for (const parameter of parameters) {
          const id = parameter?.Id;
          const value = Number(parameter?.Value);
          const blend = String(parameter?.Blend || 'Overwrite').toLowerCase();

          if (!id || Number.isNaN(value)) continue;

          try {
            if (blend === 'add' && typeof coreModel.addParameterValueById === 'function') {
              coreModel.addParameterValueById(id, value, 1);
            } else if (blend === 'multiply' && typeof coreModel.multiplyParameterValueById === 'function') {
              coreModel.multiplyParameterValueById(id, value, 1);
            } else if (typeof coreModel.setParameterValueById === 'function') {
              coreModel.setParameterValueById(id, value, 1);
            }
          } catch (_) {}
        }
      }

      function ensureExpressionTicker() {
        if (!app || expressionTicker) return;

        expressionTicker = () => {
          if (!model || (!activeMoodExpression && !activeOverlayExpression && !activeCostume)) return;

          if (activeOverlayExpression && overlayExpiresAt > 0 && performance.now() >= overlayExpiresAt) {
            activeOverlayExpression = null;
            overlayExpiresAt = 0;
          }

          restoreBaseParameters();
          applyExpressionParameters(activeCostume);
          applyExpressionParameters(activeMoodExpression);
          applyExpressionParameters(activeOverlayExpression);
        };

        app.ticker.add(expressionTicker);
      }

      function reapplyActiveExpressions() {
        if (!model) return;

        restoreBaseParameters();
        applyExpressionParameters(activeCostume);
        applyExpressionParameters(activeMoodExpression);
        applyExpressionParameters(activeOverlayExpression);
      }

      async function resolveExpression(name) {
        const expression = (cfg.expressions || []).find((item) => item.name === name);
        if (!expression) {
          throw new Error('Expression not found: ' + name);
        }

        if (expressionCache.has(name)) {
          return expressionCache.get(name);
        }

        let data = expression.json;
        if (!data && expression.uri) {
          const isLocalProtocol = location.protocol === 'file:' || location.protocol === 'asset:';
          const response = await fetch(expression.uri, isLocalProtocol ? {} : { cache: 'no-store' });
          if (!response.ok) {
            postFetchDebug({ type: 'fetchError', url: expression.uri, status: response.status });
            throw new Error('Expression fetch failed: ' + response.status);
          }
          data = await response.json();
        }

        if (!data) {
          throw new Error('Expression data unavailable: ' + name);
        }

        expressionCache.set(name, data);
        return data;
      }

      async function setMoodExpression(name) {
        if (!model) return;

        try {
          if (!name) {
            activeMoodExpression = null;
            reapplyActiveExpressions();
            setStatus('Mood cleared');
            return;
          }

          const expressionData = await resolveExpression(name);
          activeMoodExpression = expressionData;
          reapplyActiveExpressions();
          setStatus('Mood: ' + name);
        } catch (err) {
          setStatus('Mood error: ' + (err?.message || err));
        }
      }

      async function applyCostume(name) {
        if (!model) return;

        try {
          if (!name) {
            activeCostume = null;
            reapplyActiveExpressions();
            setStatus('Costume: default');
            return;
          }

          const expressionData = await resolveExpression(name);
          activeCostume = expressionData;
          reapplyActiveExpressions();
          setStatus('Costume: ' + name);
        } catch (err) {
          setStatus('Costume error: ' + (err?.message || err));
        }
      }

      async function triggerReaction(name, durationMs = 2200) {
        if (!model || !name) return;

        try {
          const expressionData = await resolveExpression(name);
          activeOverlayExpression = expressionData;
          overlayExpiresAt = performance.now() + Math.max(400, Number(durationMs) || 2200);
          reapplyActiveExpressions();
          setStatus('Reaction: ' + name);
        } catch (err) {
          setStatus('Reaction error: ' + (err?.message || err));
        }
      }

      function getParameterIds(coreModel) {
        if (!coreModel) return [];

        try {
          if (typeof coreModel.getParameterIds === 'function') {
            const ids = coreModel.getParameterIds();
            if (Array.isArray(ids)) return ids;
          }
        } catch (_) {}

        const rawIds = coreModel._parameterIds || coreModel.parameters?.ids || [];
        if (Array.isArray(rawIds)) return rawIds;

        try {
          return Array.from(rawIds);
        } catch (_) {
          return [];
        }
      }

      function getParameterIdText(id) {
        try {
          if (typeof id === 'string') return id;
          if (id && typeof id.getString === 'function') return id.getString();
          return String(id || '');
        } catch (_) {
          return '';
        }
      }

      function resolveMouthParameter() {
        const coreModel = model?.internalModel?.coreModel;
        if (!coreModel || mouthParamIndex >= 0 || mouthParamId) return;

        try {
          const ids = getParameterIds(coreModel);
          const count =
            typeof coreModel.getParameterCount === 'function'
              ? Number(coreModel.getParameterCount()) || ids.length
              : ids.length;

          for (let i = 0; i < count; i += 1) {
            const id = ids[i];
            const idText = getParameterIdText(id);
            if (/ParamMouthOpenY|MouthOpen|LipSync/i.test(idText)) {
              mouthParamIndex = i;
              mouthParamId = id || idText || 'ParamMouthOpenY';
              break;
            }
          }
        } catch (_) {}

        if (!mouthParamId) {
          mouthParamId = 'ParamMouthOpenY';
        }
      }

      function applyMouthValue(value) {
        const coreModel = model?.internalModel?.coreModel;
        if (!coreModel) return false;

        const normalizedValue = Math.max(0, Math.min(1, Number(value) || 0));
        resolveMouthParameter();

        try {
          if (mouthParamIndex >= 0 && typeof coreModel.setParameterValueByIndex === 'function') {
            coreModel.setParameterValueByIndex(mouthParamIndex, normalizedValue, 1);
            return true;
          }
        } catch (_) {}

        try {
          if (mouthParamId && typeof coreModel.setParameterValueById === 'function') {
            coreModel.setParameterValueById(mouthParamId, normalizedValue, 1);
            return true;
          }
        } catch (_) {}

        try {
          if (typeof coreModel.setParameterValueById === 'function') {
            coreModel.setParameterValueById('ParamMouthOpenY', normalizedValue, 1);
            return true;
          }
        } catch (_) {}

        return false;
      }

      function updateLipSync() {
        if (!lipSyncMode || !model) return;

        const elapsed = performance.now() - lipSyncStartedAt;
        const mouthValue =
          lipSyncMode === 'sequence'
            ? lipSyncCues[Math.min(lipSyncCues.length - 1, Math.floor(elapsed / lipSyncCueIntervalMs))] || 0
            : 0.15 + Math.abs(Math.sin((elapsed / 1000) * 12.0)) * 0.85;

        const ok = applyMouthValue(mouthValue);
        if (!ok) {
          stopLipSyncTest('Lip Sync: parameter not found');
          return;
        }

        const finished =
          (lipSyncMode === 'test' && elapsed >= (model.__codexLipSyncDurationMs || 4000)) ||
          (lipSyncMode === 'sequence' && elapsed >= lipSyncCues.length * lipSyncCueIntervalMs);

        if (finished) {
          stopLipSyncTest(lipSyncMode === 'sequence' ? 'Lip Sync sequence finished' : 'Lip Sync test finished');
        }
      }

      function installLipSyncUpdateHook() {
        const internalModel = model?.internalModel;
        if (!internalModel || internalModel.__codexLipSyncInstalled) return;
        if (typeof internalModel.update !== 'function') return;

        const originalUpdate = internalModel.update.bind(internalModel);
        internalModel.update = (...args) => {
          originalUpdate(...args);
          updateLipSync();
        };
        internalModel.__codexLipSyncInstalled = true;
      }

      function stopLipSyncTest(statusText) {
        if (app && lipSyncTicker) {
          app.ticker.remove(lipSyncTicker);
        }
        lipSyncTicker = null;
        lipSyncMode = null;
        lipSyncCues = [];
        model && (model.__codexLipSyncDurationMs = 0);
        applyMouthValue(0);
        if (statusText) {
          setStatus(statusText);
        }
      }

      function startLipSyncTest(durationMs = 4000) {
        if (!model) {
          setStatus('Lip Sync: model not ready');
          return;
        }

        installLipSyncUpdateHook();
        stopLipSyncTest();
        lipSyncStartedAt = performance.now();
        lipSyncMode = 'test';
        lipSyncCueIntervalMs = 50;
        lipSyncCues = [];
        model.__codexLipSyncDurationMs = Math.max(100, Number(durationMs) || 4000);
        setStatus('Lip Sync test started');
      }

      function startLipSyncSequence(cues, cueIntervalMs = 50) {
        if (!model) {
          setStatus('Lip Sync: model not ready');
          return;
        }

        installLipSyncUpdateHook();
        stopLipSyncTest();
        lipSyncStartedAt = performance.now();
        lipSyncMode = 'sequence';
        lipSyncCues = Array.isArray(cues) ? cues.map((value) => Number(value) || 0) : [];
        lipSyncCueIntervalMs = Math.max(16, Number(cueIntervalMs) || 50);

        if (lipSyncCues.length === 0) {
          applyMouthValue(0);
          setStatus('Lip Sync: empty sequence');
          return;
        }

        setStatus('Lip Sync sequence started');
      }

      function attachMessageBridge() {
        const handle = (event) => {
          try {
            const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (payload?.type === 'playExpression' && payload?.name) {
              void triggerReaction(payload.name, payload?.durationMs || 2200);
              return;
            }
            if (payload?.type === 'setCostume') {
              void applyCostume(payload?.name || null);
              return;
            }
            if (payload?.type === 'setMood') {
              void setMoodExpression(payload?.name || null);
              return;
            }
            if (payload?.type === 'triggerReaction') {
              void triggerReaction(payload?.name || null, payload?.durationMs || 2200);
              return;
            }
            if (payload?.type === 'playLipSyncSequence') {
              startLipSyncSequence(payload?.cues || [], payload?.cueIntervalMs || 50);
              return;
            }
            if (payload?.type === 'lipSyncTest') {
              startLipSyncTest(payload?.durationMs || 4000);
            }
          } catch (_) {}
        };

        document.addEventListener('message', handle);
        window.addEventListener('message', handle);
      }

      window.addEventListener('error', (event) => {
        setStatus('Runtime error: ' + describeError(event.error || event));
      });

      window.addEventListener('unhandledrejection', (event) => {
        setStatus('Promise error: ' + describeError(event.reason));
      });

      async function injectInlineScripts(scripts, label) {
        for (const scriptText of scripts || []) {
          if (!scriptText) continue;
          setStatus('Loading ' + label + '...');
          const scriptEl = document.createElement('script');
          scriptEl.type = 'text/javascript';
          scriptEl.text = scriptText;
          document.head.appendChild(scriptEl);
        }
      }

      async function loadScriptWithFallback(urls, label) {
        let lastErr;
        for (const url of urls) {
          try {
            setStatus('Loading ' + label + '...');
            await new Promise((resolve, reject) => {
              const s = document.createElement('script');
              s.src = url;
              s.async = true;
              s.onload = resolve;
              s.onerror = (event) => reject(event);
              document.head.appendChild(s);
            });
            return;
          } catch (err) {
            lastErr = err;
          }
        }
        throw new Error(label + ' failed: ' + (lastErr?.message || lastErr || 'unknown'));
      }

      async function ensureLibrariesLoaded() {
        if (cfg.inlineScriptContents?.core?.length) {
          await injectInlineScripts(cfg.inlineScriptContents.core, 'Live2D Core');
        } else {
          await loadScriptWithFallback(cfg.scriptSources.core, 'Live2D Core');
        }

        if (cfg.inlineScriptContents?.pixi?.length) {
          await injectInlineScripts(cfg.inlineScriptContents.pixi, 'PIXI');
        } else {
          await loadScriptWithFallback(cfg.scriptSources.pixi, 'PIXI');
        }

        if (cfg.inlineScriptContents?.live2dDisplay?.length) {
          await injectInlineScripts(cfg.inlineScriptContents.live2dDisplay, 'pixi-live2d-display');
        } else {
          await loadScriptWithFallback(cfg.scriptSources.live2dDisplay, 'pixi-live2d-display');
        }
      }

      function dataUriToBlobUrl(uri, fallbackMimeType) {
        const match = String(uri || '').match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/i);
        if (!match) {
          throw new Error('Invalid data URI');
        }

        const mimeType = match[1] || fallbackMimeType || 'application/octet-stream';
        const isBase64 = Boolean(match[2]);
        const payload = match[3] || '';

        let blob;
        if (isBase64) {
          const binary = atob(payload);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: mimeType });
        } else {
          blob = new Blob([decodeURIComponent(payload)], { type: mimeType });
        }

        return URL.createObjectURL(blob);
      }

      async function toBlobUrl(url, mimeType) {
        if (!url) {
          throw new Error('Prefetch URL is empty');
        }

        if (String(url).startsWith('blob:')) {
          return url;
        }

        if (String(url).startsWith('data:')) {
          return dataUriToBlobUrl(url, mimeType);
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Prefetch failed: ' + response.status + ' ' + url);
        }

        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: mimeType || 'application/octet-stream' });
        return URL.createObjectURL(blob);
      }

      async function resolveRuntimeAssets() {
        const mocUri = cfg.prefetchRuntimeAssets ? await toBlobUrl(cfg.mocUri, 'application/octet-stream') : cfg.mocUri;
        const textureUris = cfg.prefetchRuntimeAssets
          ? await Promise.all((cfg.textureUris || []).map((uri) => toBlobUrl(uri, 'image/png')))
          : cfg.textureUris;

        return {
          mocUri,
          textureUris,
        };
      }

      async function loadModel() {
        await ensureLibrariesLoaded();
        ensureFetchDebugWrapper();
        applyPixiHostSettings();
        setStatus('Preparing model...');
        const runtimeAssets = await resolveRuntimeAssets();

        setStatus('Loading renderer...');
        const resolution = getPixiResolution();
        const viewSize = getViewDimensions();
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;';
        canvas.width = viewSize.width * resolution;
        canvas.height = viewSize.height * resolution;
        app = new PIXI.Application({
          view: canvas,
          width: viewSize.width,
          height: viewSize.height,
          backgroundAlpha: 0,
          antialias: false,
          autoDensity: false,
          resolution: resolution,
          premultipliedAlpha: false,
          powerPreference: 'low-power',
          depth: false,
          stencil: false,
          failIfMajorPerformanceCaveat: false,
        });

        appRoot.appendChild(app.view);
        syncPixiViewToWindow();

        function jsonToUrl(data) {
          if (cfg.preferBlobUrls && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
            try {
              const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
              return URL.createObjectURL(blob);
            } catch (_) {}
          }

          return 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data));
        }

        async function buildModelUrl(options) {
          const original = cfg.modelJsonUrl
            ? await fetch(cfg.modelJsonUrl).then((r) => r.json())
            : JSON.parse(JSON.stringify(cfg.modelJson));

          original.FileReferences = original.FileReferences || {};
          original.FileReferences.Moc = runtimeAssets.mocUri;
          original.FileReferences.Textures = runtimeAssets.textureUris;

          if (options.includePhysics && (cfg.physicsUri || cfg.physicsJson)) {
            const physicsUrl = cfg.physicsUri
              ? cfg.physicsUri
              : jsonToUrl(cfg.physicsJson);
            original.FileReferences.Physics = physicsUrl;
          } else {
            delete original.FileReferences.Physics;
          }

          if (options.includeDisplayInfo && (cfg.displayInfoUri || cfg.displayInfoJson)) {
            const displayInfoUrl = cfg.displayInfoUri
              ? cfg.displayInfoUri
              : jsonToUrl(cfg.displayInfoJson);
            original.FileReferences.DisplayInfo = displayInfoUrl;
          } else {
            delete original.FileReferences.DisplayInfo;
          }

          if (options.includeExpressions && Array.isArray(cfg.expressions) && cfg.expressions.length > 0) {
            original.FileReferences.Expressions = cfg.expressions.map((exp) => {
              const expUrl = exp.uri ? exp.uri : jsonToUrl(exp.json);
              return { Name: exp.name, File: expUrl };
            });
          } else {
            delete original.FileReferences.Expressions;
          }

          return jsonToUrl(original);
        }

        async function tryLoadWithFallback() {
          const attempts = [];

          if (cfg.modelJsonUrl) {
            attempts.push({
              label: 'direct model json',
              directUrl: cfg.modelJsonUrl,
            });
          }

          if (!cfg.directModelOnly) {
            attempts.push(
              {
                label: 'full config',
                options: { includePhysics: true, includeDisplayInfo: true, includeExpressions: true },
              },
              {
                label: 'without display info',
                options: { includePhysics: true, includeDisplayInfo: false, includeExpressions: true },
              },
              {
                label: 'without physics/display info',
                options: { includePhysics: false, includeDisplayInfo: false, includeExpressions: true },
              },
              {
                label: 'minimal config',
                options: { includePhysics: false, includeDisplayInfo: false, includeExpressions: false },
              }
            );
          }

          const errors = [];

          for (const attempt of attempts) {
            try {
              setStatus('Trying ' + attempt.label + '...');
              const modelUrl = attempt.directUrl || (await buildModelUrl(attempt.options));
              const loadedModel = await PIXI.live2d.Live2DModel.from(modelUrl, {
                autoInteract: false,
                autoUpdate: false,
              });
              setStatus('Loaded with ' + attempt.label);
              return loadedModel;
            } catch (error) {
              errors.push(attempt.label + ': ' + describeError(error));
            }
          }

          throw new Error(errors.join(' | ') || 'Unknown error');
        }

        setStatus('Loading model...');
        const tempModel = await tryLoadWithFallback();
        await waitLive2dModelTexturesReady(tempModel);
        await new Promise((resolve) => setTimeout(resolve, 50));

        model = tempModel;
        // installRendererFallbacks(); // отключено: кастомный doDrawModel ломает батчинг Pixi; sortMode backToFront в applyPixiHostSettings
        app.stage.addChild(model);
        installLipSyncUpdateHook();
        if (typeof model.autoUpdate !== 'undefined') {
          model.autoUpdate = true;
        }

        if (LIVE2D_RENDERER_PREMULTIPLIED_ALPHA_FIX) {
          try {
            const renderer = model.internalModel && model.internalModel.renderer;
            if (renderer && renderer.premultipliedAlpha !== undefined) {
              renderer.premultipliedAlpha = true;
            }
          } catch (_) {}
        }

        app.stage.interactive = true;
        model.interactive = true;
        if (typeof model.on === 'function') {
          model.on('pointertap', () => {
            const msg = JSON.stringify({ type: 'modelTapped' });
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(msg);
            } else if (window.parent && window.parent !== window) {
              window.parent.postMessage(msg, '*');
            }
          });
        }
        scheduleFitAfterModelLoad();
        snapshotBaseParameters();
        emitRenderOrderSnapshot(model);
        setTimeout(() => reportRenderDiagnostics(), 250);
        setTimeout(() => reportRenderDiagnostics(), 1200);
        ensureExpressionTicker();

        attachViewResize();

        const webglCanvas = app.renderer?.context?.canvas || app.view;
        if (webglCanvas && webglCanvas.addEventListener) {
          webglCanvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setStatus('WebGL context lost, reloading...');
            window.setTimeout(() => {
              window.location.reload();
            }, 300);
          });
        }

        setStatus('Ready');
      }

      attachMessageBridge();
      loadModel().catch((err) => {
        setStatus('Load error: ' + describeError(err));
      });
    </script>
  </body>
</html>`;
}
