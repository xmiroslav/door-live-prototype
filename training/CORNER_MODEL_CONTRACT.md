# Four-corner visibility and uncertainty — experimental contract

This is the separate corner-model component of the approved YOLOX + keypoints architecture. It is **untrained**, not installed in the live UI, and not approved for automatic placement. Real-data/rights gates remain unchanged.

## Model

`corner_model.py`: compact initial architecture; spatial capacity/accuracy must be measured on real data before accepting it as the production corner model.

- Input `rgb_crop`: float32 `[N,3,256,256]`, RGB in 0..1, a known axis-aligned detector crop resized to square. Save its original image pixel extent separately. Never feed YOLOX's BGR 0..255 tensor here.
- Output `corner_heatmaps`: logits `[N,4,64,64]`, channels TL/TR/BR/BL of the **outer frame including trim**.
- Output `corner_visibility`: logits `[N,4]` for observed, in-crop corners. Visibility is separate from localization quality and detector objectness.
- Inference/export contract uses batch 1, fixed 256 input and opset 17. Internal model/loss batch training is supported separately.
- Crop-to-image location: `x = crop.x + (heatmap_column + 0.5) / heatmap_width * crop.width`, similarly for y. Coordinates are never replaced by a detector box or clamped into a plausible door.

The initial model is intentionally small; defining/exporting it does not prove that it can learn accurate door geometry. No trained weights are committed or offered as a usable detector.

## Annotation and loss

The loss consumes normalized crop coordinates `[N,4,2]` and explicit boolean visibility labels `[N,4]`.

Only visibly located corners supervise heatmap positions. Hidden or cropped-out corners have `visible=False`; their coordinates may be NaN and are ignored by the geometric loss. Visibility is trained for all four channels. Inferred/unknown points must not be mislabeled as visible ground truth.

Existing 21-photo labels do not supply verified visibility masks. No automatic conversion to `visible=True` has been added. Visibility masks and corner positions require annotation review before real training.

Visible corners use normalized Gaussian target distributions (sigma 1.5 heatmap cells) and spatial cross-entropy. Visibility uses binary logit loss. The all-hidden case trains visibility without inventing location supervision.

## Browser decoding and placement gate

`ai/door-corner-evidence.js` exports:

- `decodeCornerEvidence({heatmaps, heatmapShape, visibilityLogits, crop, imageWidth, imageHeight})`: stable spatial softmax statistics, peak coordinates, per-corner visibility scores, normalized entropy, probability mass in a 5x5 peak region, and crop-edge flags. Invalid/missing/nonfinite outputs fail closed.
- `assessDoorPlacement({prediction, imageWidth, imageHeight, detectorScore, modelValidated, calibrationValidated}, options)`: declines automatic placement if either validation flag is absent/false, any corner lacks reliable evidence, a peak touches a crop edge, or the existing quad validator rejects geometry. Rejections return `action: 'manual-adjustment'` and the affected corner when known.

Research defaults (not calibrated acceptance thresholds): detector score >=0.6, visibility score >=0.7, normalized entropy <=0.5, peak-region mass >=0.7. Defaults admit the intended synthetic Gaussian target but require independent calibration for the actual trained model, crop/heatmap resolution, and camera domain. Update calibration after any change of weights/preprocessing/output resolution.

The 5x5 mass check matters: two distant sharp peaks can have low entropy but still give an ambiguous corner. Entropy alone is insufficient.

These signals are **not established probabilities that a corner is correct**. A sharp heatmap can be confidently wrong. `modelValidated` and `calibrationValidated` must remain false until the actual model passes held-out real-photo checks. This module does not perform that validation itself or start model/network loading.

The classic pipeline and current experimental screen have not been wired to these untrained outputs. The returned manual-adjustment action is a programmatic result for future UI integration, not a claim that a new user notification is deployed.

## Verification

```bash
# Same CPU PyTorch/torchvision environment as YOLOX_PREFLIGHT.md.
python -m pip install -r training/requirements-corner-export.txt
python -m unittest discover -s training -p 'test_corner_*.py' -v
node training/test-corner-evidence.mjs
node training/test-door-quad.mjs
```

Tests cover exact crop mapping, skewed quads, hidden corners, diffuse/multimodal evidence, invalid outputs, model/calibration gates, visible/hidden gradient masking and actual PyTorch-to-ONNX Runtime numerical parity. The ONNX test uses random weights in a temporary file and checks `rtol=1e-4`, `atol=1e-5`; it does not train or publish a model.

Safari/Android WASM accuracy, speed, memory and calibration remain untested. The CPU export test does not establish mobile-browser compatibility/performance. Legacy TorchScript exporter deprecation warnings are recorded; export and numerical comparison pass with the pinned environment.
