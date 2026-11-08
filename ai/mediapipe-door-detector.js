// Door Live experimental MediaPipe detector adapter.
// No weights are bundled. Existing detection remains default.
// Requires a verified, custom-trained doorway .tflite model.
export async function createDoorDetector({modelAssetPath, wasmRoot = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm'} = {}) {
  if (!modelAssetPath) throw new Error('Door-trained .tflite model required; generic object detector is not suitable');
  const { FilesetResolver, ObjectDetector } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm');
  const vision = await FilesetResolver.forVisionTasks(wasmRoot);
  const detector = await ObjectDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath, delegate: 'CPU' },
    runningMode: 'IMAGE',
    maxResults: 8,
    scoreThreshold: 0.4
  });
  return {
    detect(image) {
      // Bounding boxes only: four-corner geometry must be refined separately.
      return detector.detect(image).detections.map(d => ({
        score: d.categories?.[0]?.score ?? 0,
        label: d.categories?.[0]?.categoryName ?? '',
        bbox: d.boundingBox ? {
          x: d.boundingBox.originX,
          y: d.boundingBox.originY,
          width: d.boundingBox.width,
          height: d.boundingBox.height
        } : null
      })).filter(d => d.bbox);
    },
    close() { detector.close(); }
  };
}
