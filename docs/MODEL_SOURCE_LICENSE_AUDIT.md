# Door/window model sourcing and licensing audit — 2026-11-11

This document separates **code license, pretrained weights, dataset license and end-model redistribution**. It is an engineering audit, not legal advice.

## Candidate A: YOLOX-Nano — retained baseline
- Official upstream: https://github.com/Megvii-BaseDetection/YOLOX
- **Code:** Apache-2.0 (confirmed in upstream repo).
- **Pretrained weights:** COCO detection checkpoint. The **80 COCO detection classes do not include 'door' or 'window'**, so it cannot meet our requirement before fine-tuning. Checkpoint-specific redistribution permission needs confirmation before production shipping.
- **Fit:** light architecture, ONNX support; fine-tune on licensed door/window photos, then train separate four-corner model.
- **Status:** baseline architecture approved for research; not a trained door detector and not legally approved for product weights.

## Training data: Roboflow Universe Door-Windows
- Dataset: https://universe.roboflow.com/doorswindows/door-windows/dataset/1
- Page reports **CC BY 4.0**; version lists 9,689 generated/export images (6,087 train; 2,025 val; 1,577 test), detection classes: door, window, wall, stairs.
- License requires attribution; must inspect dataset provenance and any third-party restrictions before commercial training. Test whether export is accessible; no API key should be added to repository.
- **Do not use hosted Roboflow 3.0 model weights/API as final inference infrastructure**; hosted model licensing and dataset licensing differ. The training images can be a candidate source, subject to permissions.
- Detection boxes alone DO NOT supply outer-trim four-corner labels, which need human verified annotation.

## Candidate B: RF-DETR (fallback only if YOLOX checkpoint gate fails)
- https://roboflow.com/licensing lists **RF-DETR Nano through Large (except certain enumerated tiers)** and RF-DETR Keypoint Preview as Apache-2.0.
- Require verification of the selected specific release weights, export to compatible ONNX, and actual Safari WASM performance BEFORE replacing the baseline.
- Do not silently switch frameworks.

## Explicit exclusions
- Most pretrained YOLO detection models on COCO: no door/window class without adaptation.
- Architectural **floorplan** door/window models: recognize schematic symbols, not camera photos.
- YOLOv8 projects advertising MIT wrapper code: no implied MIT grant for third-party YOLOv8 weights/framework.
- Roboflow inference API: not local and requires remote images/API credentials.

## Environment check
- Python + torch + torchvision available.
- Outbound HTTP from the current training container failed connecting to GitHub and Roboflow; this was tested, **not inferred**.
- Pretrained door/window weights and downloadable large training dataset are not locally present yet. No new actual pretrained model training has occurred.
- Next gate: legally permitted pretrained checkpoint and images must be accessible in a training environment; use a separate training machine/runner with authorized network and compute, not fake scratch-training results.

## Browser runtime
- Official ONNX Runtime Web: https://onnxruntime.ai/docs/get-started/with-javascript/web.html
- WASM: supported in iOS Safari and Chrome Android; WebGPU is not a safe universal dependency.
- Self-host JS and WASM version-pinned on origin; verify fallback, iOS memory footprint and performance before shipping.
