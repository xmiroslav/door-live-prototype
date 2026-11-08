# Doorway ML training — data contract

The live site now probes for `ml/models/doorway-keypoints.onnx`. **No trained weights have been published yet.** Until a validated model is provided, geometry detection remains active.

## Dataset
Collect consented photos of real doorways in varied lighting, distances and angles, including open doors, white-on-white frames, narrow passages, wide-angle iPhone photos, and challenging negatives (coat racks, windows, cabinets). Do not upload personal photos to a public repository without permission.

Use JSONL rows:
```json
{"image":"images/example-001.jpg","corners":[[0.21,0.16],[0.74,0.18],[0.78,0.91],[0.19,0.93]],"present":true}
{"image":"images/negative-001.jpg","corners":null,"present":false}
```
Corners are **normalized to the original full image** and ordered top-left, top-right, bottom-right, bottom-left. For closed doors annotate the **outer jamb**, not the door panel. For open doors annotate the actual opening frame. Include negatives and difficult occlusions.

## Deployment contract
ONNX input float32 `[1,3,320,320]` RGB scaled 0–1. Named outputs `corners` float32 `[1,8]` (normalized coordinates), `confidence` float32 `[1,1]` (probability of doorway). The current browser adapter resizes the full input image to 320×320; training must use the same preprocessing. Model must be trained and validated before placing at `ml/models/doorway-keypoints.onnx`.

## Acceptance checks
Evaluate on a held-out split by **location** (not adjacent video frames). Measure four-corner error, IoU, false positives on coat racks, and inference time on iPhone Safari. Test 3–4 second acquisition, then moving camera tracking separately. Never claim robust world anchoring from a still-image detector.
