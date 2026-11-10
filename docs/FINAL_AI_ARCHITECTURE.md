# Door Live — selected production direction (2026-11-10)

## Architecture decision

**Pretrained backbone:** Google EfficientDet-Lite0 (320x320) as a *starting point* for fine-tuning a **door-frame detector**. **Not** a ready-made door detector: the stock COCO classes do not contain a dedicated doorway/frame class. Do not deploy its stock weights as if they detect doors. Validate model-file license and training-data obligations before any commercial use.

**Four corners:** separate trainable 4-keypoint regressor / heatmap head on a detected crop (TL,TR,BR,BL of **fixed outer frame including trim**), using verified labels. A bounding box is never an installation quad. Reject invalid quads; user can adjust corners.

**Runtime:** TFLite in browser with MediaPipe Tasks for the *detector*. A custom keypoint TFLite model needs a compatible inference path (TFLite JS/WASM or other verified browser runtime); MediaPipe ObjectDetector alone cannot output corners. Alternative ONNX Runtime Web WASM for the keypoint head if TFLite integration is unsuitable. No native app required. Safari iOS / Chrome Android real-device testing mandatory.

**Camera:** getUserMedia on HTTPS; render video locally; throttle inference; stabilize quadrilateral with optical flow or tracking and re-detection, not a screen-fixed overlay. Pause tracks when hidden; release on exit. A stable world-anchored overlay is **not implemented yet**.

**Commercial licensing:** Ultralytics YOLO11 was not selected because AGPL-3.0 / Enterprise terms may not fit proprietary Unidoors deployment. MediaPipe framework is Apache 2.0; individual pretrained weights and training datasets require separate review. Google EfficientDet-Lite0 is the current candidate, pending specific model artifact provenance/license verification.

## Current experiment

The experimental-phone-test.html page now offers a separate **ניסוי חדש** flow for upload and live camera, manual four-corner placement, and the existing heuristic candidate detector. It **does not yet run trained ML weights**, and live preview does **not** provide reliable camera-motion anchoring. Classic system remains untouched.

## Training gates

1. Correct provisional annotation quads with the user's red outer-trim corrections.
2. Split by physical doorway, not adjacent frames of the same doorway.
3. Add more unique doorway groups and negatives (windows, wardrobes, etc.).
4. Fine-tune the licensed pretrained detector and train the keypoint head.
5. Export browser model artifacts; test on Safari iPhone and Chrome Android.
6. Activate ML only after held-out accuracy, performance, and licensing checks.

References:
- https://developers.google.com/edge/mediapipe/solutions/vision/object_detector
- https://onnxruntime.ai/docs/get-started/with-javascript/web.html
- https://www.ultralytics.com/license
