export const unsupportedCubism5Models = {
  model3: {
    reason:
      'This model uses moc3 version 5 (Cubism 5), but the current pixi-live2d-display renderer supports Cubism 4 models only.',
  },
  model5: {
    reason:
      'This model uses moc3 version 5 (Cubism 5), but the current pixi-live2d-display renderer supports Cubism 4 models only.',
  },
  model7: {
    reason:
      'This model uses moc3 version 5 (Cubism 5), but the current pixi-live2d-display renderer supports Cubism 4 models only.',
  },
};

export function getModelCompatibility(modelKey) {
  return unsupportedCubism5Models[modelKey] || null;
}
