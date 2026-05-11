type ViewerModelConfig = {
  modelDir: string;
  modelJson: string;
  label?: string;
};

export type ViewerCommand =
  | { type: 'playExpression'; name: string }
  | { type: 'lipSyncTest'; durationMs?: number }
  | { type: 'playLipSyncSequence'; cues?: number[]; cueIntervalMs?: number };

const statusEl = document.getElementById('status');

function postToHost(payload: Record<string, unknown>) {
  const serialized = JSON.stringify(payload);

  if ((window as any).ReactNativeWebView?.postMessage) {
    (window as any).ReactNativeWebView.postMessage(serialized);
    return;
  }

  if (window.parent && window.parent !== window) {
    window.parent.postMessage(serialized, '*');
  }
}

export function setStatus(text: string) {
  if (statusEl) {
    statusEl.textContent = text;
  }

  postToHost({ type: 'status', text });
}

export function sendReady(label: string) {
  postToHost({ type: 'ready', label });
}

export function sendError(text: string) {
  setStatus(text);
}

export function parseViewerConfig(): ViewerModelConfig {
  const params = new URLSearchParams(window.location.search);

  const modelDir = params.get('modelDir') || '';
  const modelJson = params.get('modelJson') || '';
  const label = params.get('label') || modelJson || 'Live2D Model';

  return { label, modelDir, modelJson };
}

export function attachCommandBridge(handler: (command: ViewerCommand) => void) {
  const onMessage = (rawData: unknown) => {
    try {
      const payload =
        typeof rawData === 'string' ? JSON.parse(rawData as string) : rawData;

      if (!payload || typeof payload !== 'object') {
        return;
      }

      handler(payload as ViewerCommand);
    } catch {
      // Ignore malformed messages from extensions or unrelated frames.
    }
  };

  document.addEventListener('message', (event: Event) => {
    onMessage((event as MessageEvent).data);
  });

  window.addEventListener('message', (event) => {
    onMessage(event.data);
  });
}
