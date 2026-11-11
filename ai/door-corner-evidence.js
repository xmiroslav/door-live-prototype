// Experimental corner-model output contract. No model weights are bundled here.
import {validateDoorQuad} from './door-quad-validation.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const validUnit = value => finite(value) && value >= 0 && value <= 1;

export function decodeCornerEvidence({heatmaps, heatmapShape, visibilityLogits, crop,
  imageWidth, imageHeight} = {}) {
  const fail = reason => ({available: false, reason});
  if (!finite(imageWidth) || !finite(imageHeight) || imageWidth <= 0 || imageHeight <= 0)
    return fail('invalid-image-size');
  if (!crop || !['x','y','width','height'].every(key => finite(crop[key])) ||
      crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 ||
      crop.x + crop.width > imageWidth || crop.y + crop.height > imageHeight)
    return fail('invalid-crop');
  if (!Array.isArray(heatmapShape) || heatmapShape.length !== 4 ||
      heatmapShape[0] !== 1 || heatmapShape[1] !== 4 ||
      !heatmapShape.slice(2).every(value => Number.isInteger(value) && value >= 2 && value <= 256))
    return fail('incompatible-heatmap-shape');
  const [, , height, width] = heatmapShape;
  const cells = width * height;
  if (!heatmaps || heatmaps.length !== 4 * cells ||
      !visibilityLogits || visibilityLogits.length !== 4)
    return fail('missing-corner-outputs');
  const corners = [], evidence = [];
  for (let corner = 0; corner < 4; corner++) {
    const offset = corner * cells;
    let peak = -Infinity, peakIndex = 0;
    for (let i = 0; i < cells; i++) {
      const value = heatmaps[offset + i];
      if (!finite(value)) return fail('nonfinite-corner-output');
      if (value > peak) { peak = value; peakIndex = i; }
    }
    if (!finite(visibilityLogits[corner])) return fail('nonfinite-corner-output');
    let sum = 0, weightedLogit = 0;
    for (let i = 0; i < cells; i++) {
      const shifted = heatmaps[offset + i] - peak;
      const mass = Math.exp(shifted);
      sum += mass;
      // Extreme finite logits can overflow subtraction to -Infinity; 0*Infinity is NaN.
      if (mass > 0) weightedLogit += mass * shifted;
    }
    const entropy = (Math.log(sum) - weightedLogit / sum) / Math.log(cells);
    const x = peakIndex % width, y = Math.floor(peakIndex / width);
    let localMass = 0;
    for (let yy = Math.max(0, y - 2); yy <= Math.min(height - 1, y + 2); yy++) {
      for (let xx = Math.max(0, x - 2); xx <= Math.min(width - 1, x + 2); xx++)
        localMass += Math.exp(heatmaps[offset + yy * width + xx] - peak);
    }
    corners.push([crop.x + (x + .5) / width * crop.width,
                  crop.y + (y + .5) / height * crop.height]);
    evidence.push({visibilityScore: 1 / (1 + Math.exp(-visibilityLogits[corner])),
      normalizedEntropy: Math.max(0, Math.min(1, entropy)),
      peakRegionMass: Math.min(1, localMass / sum),
      atCropEdge: x === 0 || y === 0 || x === width - 1 || y === height - 1});
  }
  return {available: true, corners, evidence};
}

export function assessDoorPlacement({prediction, imageWidth, imageHeight, detectorScore,
  modelValidated, calibrationValidated} = {}, options = {}) {
  const reject = (reason, cornerIndex) => ({accepted: false, reason,
    ...(cornerIndex === undefined ? {} : {cornerIndex}), action: 'manual-adjustment'});
  if (modelValidated !== true) return reject('model-not-validated');
  if (calibrationValidated !== true) return reject('calibration-not-validated');
  const minimumDetectorScore = options.minimumDetectorScore ?? .6;
  const minimumVisibilityScore = options.minimumVisibilityScore ?? .7;
  const maximumEntropy = options.maximumEntropy ?? .5;
  const minimumPeakRegionMass = options.minimumPeakRegionMass ?? .7;
  if (![minimumDetectorScore, minimumVisibilityScore, maximumEntropy, minimumPeakRegionMass].every(validUnit))
    return reject('invalid-thresholds');
  if (!validUnit(detectorScore) || detectorScore < minimumDetectorScore)
    return reject('low-detector-score');
  if (prediction?.available !== true || !Array.isArray(prediction.evidence) || prediction.evidence.length !== 4)
    return reject('missing-corner-evidence');
  for (let corner = 0; corner < 4; corner++) {
    const item = prediction.evidence[corner];
    if (!item || !validUnit(item.visibilityScore) || !validUnit(item.normalizedEntropy) ||
        !validUnit(item.peakRegionMass) ||
        typeof item.atCropEdge !== 'boolean') return reject('invalid-corner-evidence', corner);
    if (item.visibilityScore < minimumVisibilityScore) return reject('corner-not-visible', corner);
    if (item.normalizedEntropy > maximumEntropy) return reject('uncertain-corner-location', corner);
    if (item.peakRegionMass < minimumPeakRegionMass) return reject('ambiguous-corner-location', corner);
    if (item.atCropEdge) return reject('corner-at-crop-edge', corner);
  }
  const geometry = validateDoorQuad(prediction.corners, imageWidth, imageHeight);
  if (!geometry.valid) return reject(geometry.reason);
  return {accepted: true, corners: prediction.corners, geometry};
}
