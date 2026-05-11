/**
 * React Native / Expo вызывает window.__codexStartDirectLipSync и т.д. из injectJavaScript.
 * Основной lip-sync в viewer.js уже крутится в конце model.update() (через postMessage).
 * Этот файл только пересылает вызовы в тот же канал, что и postMessage, без setInterval.
 */
(function () {
  function dispatch(data) {
    try {
      var serialized = typeof data === 'string' ? data : JSON.stringify(data);
      document.dispatchEvent(new MessageEvent('message', { data: serialized }));
      window.dispatchEvent(new MessageEvent('message', { data: serialized }));
    } catch (_) {}
  }

  window.__codexStartDirectLipSync = function (durationMs) {
    dispatch({
      type: 'lipSyncTest',
      durationMs: Math.max(300, Number(durationMs) || 1200),
    });
  };

  window.__codexStopDirectLipSync = function () {
    dispatch({ type: '_codexStopLip' });
  };

  window.__codexHandleStagePayload = function (payload) {
    try {
      var obj = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (!obj || typeof obj !== 'object') return;
      dispatch(obj);
    } catch (_) {}
  };
})();
