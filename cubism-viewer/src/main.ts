import { CubismDefaultParameterId } from '@framework/cubismdefaultparameterid';
import { CubismFramework } from '@framework/live2dcubismframework';
import { LAppDelegate } from './lappdelegate';
import {
  attachCommandBridge,
  parseViewerConfig,
  sendError,
  sendReady,
  setStatus,
  type ViewerCommand,
} from './viewerbridge';

/** Live2D LoadStep.CompleteSetup — model is safe to drive from JS. */
const LOAD_COMPLETE = 23;

type LipMode = 'idle' | 'test' | 'sequence';

const lipSyncState: {
  mode: LipMode;
  testUntil: number;
  sequenceStart: number;
  sequenceUntil: number;
  cues: number[];
  cueIntervalMs: number;
} = {
  mode: 'idle',
  testUntil: 0,
  sequenceStart: 0,
  sequenceUntil: 0,
  cues: [],
  cueIntervalMs: 50,
};

function stopLipSync() {
  lipSyncState.mode = 'idle';
  lipSyncState.testUntil = 0;
  lipSyncState.sequenceStart = 0;
  lipSyncState.sequenceUntil = 0;
  lipSyncState.cues = [];
}

function getParameterIdText(id: unknown): string {
  try {
    if (typeof id === 'string') return id;
    if (id && typeof (id as { getString?: () => string }).getString === 'function') {
      return (id as { getString: () => string }).getString();
    }
    return String(id || '');
  } catch {
    return '';
  }
}

function resolveMouthTargetId(model: any): unknown {
  const fromList = model._lipSyncIds?.[0];
  if (fromList) {
    return fromList;
  }

  const cm = model._model;
  if (cm && typeof cm.getParameterCount === 'function') {
    const n = Number(cm.getParameterCount()) || 0;
    for (let i = 0; i < n; i += 1) {
      const id = typeof cm.getParameterId === 'function' ? cm.getParameterId(i) : null;
      const text = getParameterIdText(id);
      if (/ParamMouthOpenY|MouthOpen|LipSync/i.test(text)) {
        return id;
      }
    }
  }

  return CubismFramework.getIdManager().getId(CubismDefaultParameterId.ParamMouthOpenY);
}

function computeMouthValue(now: number): number {
  if (lipSyncState.mode === 'sequence' && lipSyncState.cues.length > 0) {
    if (now >= lipSyncState.sequenceUntil) {
      return 0;
    }
    const elapsed = now - lipSyncState.sequenceStart;
    const idx = Math.min(
      lipSyncState.cues.length - 1,
      Math.floor(elapsed / lipSyncState.cueIntervalMs)
    );
    return lipSyncState.cues[idx] ?? 0;
  }

  if (lipSyncState.mode === 'test') {
    if (now > lipSyncState.testUntil) {
      return 0;
    }
    const t = now / 1000;
    return 0.15 + Math.abs(Math.sin(t * 12.0)) * 0.85;
  }

  return 0;
}

function advanceLipSyncState(now: number) {
  if (lipSyncState.mode === 'sequence' && lipSyncState.cues.length > 0 && now >= lipSyncState.sequenceUntil) {
    stopLipSync();
    return;
  }
  if (lipSyncState.mode === 'test' && now > lipSyncState.testUntil) {
    stopLipSync();
  }
}

function applyLipSyncMouth(model: any) {
  if (model._state !== LOAD_COMPLETE) {
    return;
  }

  const cubismModel = model._model;
  if (!cubismModel || typeof cubismModel.setParameterValueById !== 'function') {
    return;
  }

  const now = performance.now();
  advanceLipSyncState(now);

  const mouthValue = Math.max(0, Math.min(1, computeMouthValue(now)));
  if (lipSyncState.mode === 'idle' && mouthValue < 0.001) {
    return;
  }

  try {
    const targetId = resolveMouthTargetId(model);
    cubismModel.setParameterValueById(targetId, mouthValue, 1.0);
  } catch (error) {
    sendError(`Lip Sync error: ${String((error as Error)?.message || error)}`);
    stopLipSync();
  }
}

function ensureLipSyncPatch(model: any) {
  if (!model || model.__codexLipSyncPatched) {
    return;
  }

  const originalUpdate = model.update.bind(model);
  model.update = () => {
    originalUpdate();
    applyLipSyncMouth(model);
  };

  model.__codexLipSyncPatched = true;
}

function getActiveModel() {
  return LAppDelegate.getInstance().getSubdelegates()?.[0]?.getLive2DManager()?.getModel?.() || null;
}

function handleViewerCommand(command: ViewerCommand) {
  const model = getActiveModel();
  if (!model) {
    return;
  }

  ensureLipSyncPatch(model);

  if (command.type === 'playExpression') {
    model.setExpression(command.name);
    setStatus(`Expression: ${command.name}`);
  }

  if (command.type === 'lipSyncTest') {
    const durationMs = Math.max(100, Number(command.durationMs) || 4000);
    lipSyncState.testUntil = performance.now() + durationMs;
    if (lipSyncState.mode !== 'sequence') {
      lipSyncState.mode = 'test';
    }
    setStatus('Lip Sync started');
  }

  if (command.type === 'playLipSyncSequence') {
    const raw = Array.isArray(command.cues) ? command.cues : [];
    const cues = raw.map((v) => Math.max(0, Math.min(1, Number(v) || 0)));
    if (cues.length === 0) {
      return;
    }
    lipSyncState.mode = 'sequence';
    lipSyncState.cues = cues;
    lipSyncState.cueIntervalMs = Math.max(16, Number(command.cueIntervalMs) || 50);
    lipSyncState.sequenceStart = performance.now();
    lipSyncState.sequenceUntil =
      lipSyncState.sequenceStart + cues.length * lipSyncState.cueIntervalMs + 80;
  }
}

function installNativePayloadBridge() {
  (window as any).__codexHandleStagePayload = (payload: unknown) => {
    try {
      const command = typeof payload === 'string' ? JSON.parse(payload as string) : payload;
      if (!command || typeof command !== 'object') {
        return;
      }
      handleViewerCommand(command as ViewerCommand);
    } catch {
      // ignore
    }
  };

  (window as any).__codexStartDirectLipSync = (durationMs: number) => {
    const ms = Math.max(300, Number(durationMs) || 1200);
    lipSyncState.mode = 'test';
    lipSyncState.testUntil = performance.now() + ms;
  };

  (window as any).__codexStopDirectLipSync = () => {
    stopLipSync();
  };
}

window.addEventListener(
  'load',
  (): void => {
    const config = parseViewerConfig();
    if (!config.modelDir || !config.modelJson) {
      sendError('Missing modelDir or modelJson');
      return;
    }

    setStatus(`Preparing ${config.label || config.modelJson}...`);

    if (!LAppDelegate.getInstance().initialize()) {
      sendError('Cubism viewer failed to initialize');
      return;
    }

    installNativePayloadBridge();
    attachCommandBridge(handleViewerCommand);

    let readySent = false;
    const originalRun = LAppDelegate.getInstance().run.bind(LAppDelegate.getInstance());
    LAppDelegate.getInstance().run = () => {
      const loop = (): void => {
        const model = getActiveModel();
        if (!model) {
          requestAnimationFrame(loop);
          return;
        }

        ensureLipSyncPatch(model);

        const isReady = Boolean(model._state === LOAD_COMPLETE);
        if (isReady && !readySent) {
          readySent = true;
          setStatus('Ready');
          sendReady(config.label || config.modelJson);
        }

        requestAnimationFrame(loop);
      };

      originalRun();
      loop();
    };

    LAppDelegate.getInstance().run();
  },
  { passive: true }
);

window.addEventListener(
  'beforeunload',
  (): void => LAppDelegate.releaseInstance(),
  { passive: true }
);

window.addEventListener('error', (event) => {
  sendError(`Runtime error: ${event.message}`);
});

window.addEventListener('unhandledrejection', (event) => {
  sendError(`Promise error: ${String(event.reason?.message || event.reason || 'unknown')}`);
});
