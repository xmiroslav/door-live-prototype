// Door Live AI: opt-in MediaPipe doorway candidate detector.
// A custom, licensed door-trained .tflite model is required. No weights are bundled.
// MediaPipe ObjectDetector predicts bounding boxes, NOT four perspective corners.
const VERSION = '0.10.22';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const STATES = new Set(['IMAGE', 'VIDEO']);
export async function createDoorDetector({
  modelAssetPath,
  wasmRoot = `${CDN}/wasm`,
  runningMode = 'IMAGE',
  scoreThreshold = 0.4,
  maxResults = 8,
  allowedLabels = ['doorway_frame', 'doorway']
} = {}) {
  if (!modelAssetPath || typeof modelAssetPath !== 'string')
    throw new Error('A commercially cleared, doorway-trained .tflite model is required.');
  if (!STATES.has(runningMode)) throw new Error('runningMode must be IMAGE or VIDEO');
  const { FilesetResolver, ObjectDetector } = await import(`${CDN}/+esm`);
  const vision = await FilesetResolver.forVisionTasks(wasmRoot);
  const detector = await ObjectDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath, delegate: 'CPU' },
    runningMode, maxResults, scoreThreshold
  });
  const labels = new Set(allowedLabels);
  let lastTimestamp = -1;
  function parse(result) {
    return (result.detections || []).map(d => {
      const category = d.categories?.[0];
      const b = d.boundingBox;
      if (!category || !b || !labels.has(category.categoryName)) return null;
      const { originX: x, originY: y, width, height } = b;
      if (![x,y,width,height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
      return {
        score: category.score ?? 0,
        label: category.categoryName,
        bbox: { x, y, width, height },
        // A bounding rectangle is NOT a verified doorway installation quad.
        corners: null,
        geometryVerified: false
      };
    }).filter(Boolean).sort((a,b) => b.score-a.score);
  }
  return {
    runningMode,
    detect(image) {
      if (runningMode !== 'IMAGE') throw new Error('Use detectVideo in VIDEO mode');
      return parse(detector.detect(image));
    },
    detectVideo(video, timestampMs) {
      if (runningMode !== 'VIDEO') throw new Error('Use detect in IMAGE mode');
      if (!Number.isFinite(timestampMs) || timestampMs <= lastTimestamp)
        throw new Error('Video timestamps must increase monotonically');
      lastTimestamp = timestampMs;
      return parse(detector.detectForVideo(video, timestampMs));
    },
    close() { detector.close(); }
  };
}
