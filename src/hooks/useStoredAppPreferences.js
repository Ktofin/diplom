import { useEffect, useRef, useState } from 'react';
import { loadStoredPreferences, saveStoredPreferences } from '../app/preferencesStorage';

export function useStoredAppPreferences({
  backgroundKey,
  modelKey,
  selectedCostume,
  setBackgroundKey,
  setModelKey,
  setSelectedCostume,
}) {
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const hydrationStartedRef = useRef(false);

  useEffect(() => {
    if (hydrationStartedRef.current) return;
    hydrationStartedRef.current = true;

    let active = true;

    loadStoredPreferences()
      .then((stored) => {
        if (!active || !stored || typeof stored !== 'object') return;

        if (typeof stored.backgroundKey === 'string') {
          setBackgroundKey(stored.backgroundKey);
        }

        if (typeof stored.modelKey === 'string') {
          setModelKey(stored.modelKey);
        }

        if (typeof stored.selectedCostume === 'string' || stored.selectedCostume === null) {
          setSelectedCostume(stored.selectedCostume ?? null);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setPreferencesLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [setBackgroundKey, setModelKey, setSelectedCostume]);

  useEffect(() => {
    if (!preferencesLoaded) return;

    saveStoredPreferences({
      backgroundKey,
      modelKey,
      selectedCostume,
    }).catch(() => undefined);
  }, [backgroundKey, modelKey, preferencesLoaded, selectedCostume]);

  return { preferencesLoaded };
}
