# Door Live AI — pretrained model selection (2026-11-10)

## Selected candidate: Roboflow RF-DETR Nano (Apache-2.0 weights + code)
Sources:
- https://github.com/roboflow/rf-detr
- https://roboflow.com/model-licenses/rf-detr
- https://rfdetr.roboflow.com/latest/learn/run/detection/

This is a **candidate, not an integrated or tested detector**. Pretrained COCO object recognition does not imply a door class; fine-tuning on verified door/frame bounding regions is required. Target label: stationary outer door frame and architraves, not leaf. Candidate detection is stage one; stage two needs independently trained/refined TL,TR,BR,BL corners.

RF-DETR detection Nano/Small/Medium/Large and RF-DETR Keypoint (preview) are Apache 2.0 according to vendor. Other RF-DETR detection sizes may have a different platform license. Verify exact weight files, dependencies, NOTICE, and any dataset license before commercial deployment.

## Planned experiment
1. Assemble original clean photos with corrected red corner labels and group by physical doorway; make outer-frame detection boxes from verified corner extrema (with padding).
2. Include door-negative images (windows, cabinets, niches, nearby frames) and cases with two candidate doors.
3. Fine-tune pretrained RF-DETR Nano; compare candidate recall and false positives on held-out doorway groups. Use a stronger baseline only if justified.
4. Test an independent four-corner refinement model on each detected candidate crop; assess polygon IoU, normalized corner error, and wrong-door selection.
5. Test ONNX export and on-device web runtimes, with iPhone Safari and Android Chrome memory/latency benchmarks. RF-DETR is NOT guaranteed compatible with MediaPipe ObjectDetector TFLite metadata/output contract. Do not promise direct MediaPipe conversion.
6. Keep the current heuristic and AI modes separate; no live deployment until accuracy and performance are verified.

## Rejected/limited alternatives
- Ultralytics YOLO11: AGPL-3.0 or paid Enterprise license (https://docs.ultralytics.com/models/yolo11/).
- COCO-SSD / default MediaPipe EfficientDet-Lite0: pretrained COCO 80 classes do not include a general door class; not a ready-made door detector.
- Hugging Face rtdetrv2-floorplancad-doors: detects doors in floor plans, not real doorway photos (https://huggingface.co/joshlyman/rtdetrv2-floorplancad-doors).

## Current status
No RF-DETR weights downloaded, no fine-tuning run, no browser benchmark or model integration performed yet. The user's existing photos are a useful pilot dataset but not enough for dependable deployment.
