# Door/window model sourcing and licensing audit — 2026-11-11

This document separates **code license, pretrained weights, dataset license and end-model redistribution**. It is an engineering audit, not legal advice.

## Candidate A: YOLOX-Nano — retained baseline
- Official upstream: https://github.com/Megvii-BaseDetection/YOLOX
- **Code:** Apache-2.0 (confirmed in upstream repo).
- **Pretrained weights:** COCO detection checkpoint. The **80 COCO detection classes do not include 'door' or 'window'**, so it cannot meet our requirement before fine-tuning. Checkpoint-specific redistribution permission needs confirmation before production shipping.
- **Fit:** light architecture, ONNX support; fine-tune on licensed door/window photos, then train separate four-corner model.
- **Status:** baseline architecture approved for research; not a trained door detector and not legally approved for product weights.

## Rejected data source: Roboflow Universe Door-Windows (visual check 2026-11-11)
- Dataset: https://universe.roboflow.com/doorswindows/door-windows/dataset/1
- Page reports CC BY 4.0 and 9,689 version images. These facts alone do not establish suitability.
- **Rejected for Door Live photo training:** the project cover image and four independent version thumbnails inspected directly are architectural floorplans, not camera photographs of doorway frames. A floorplan door symbol is not a photographic door/frame target.
- Cover sample inspected: https://source.roboflow.com/0jcL25GGS6YoEAi22mXsNc5W2DV2/00F3GXOpf1yNH8YeNfLJ/original.jpg
- Version sample IDs inspected: `9d62b54898bf4e27e2da952aad4faa18`, `5a782e9a2032c64fc54ae44d62f71647`, `118d057d351f99033d9048731c5fb4ea`, `3b11dc2ad1759370d768820eb908abfb`.
- COCO export also requires sign-in, independently confirmed via the site dialog. No account was created or credentials handled.
- Do not reintroduce this dataset just because its title contains door/window. Do not ask the user to obtain its export for this product.
- The previously recorded candidate status was premature; architecture is unchanged, data-source selection is corrected before real training.

## Additional photographic data candidates — not yet approved
- Indoor Object Detection Dataset, Mendeley Data v2, DOI 10.17632/3ggxwf2vpr.2: https://data.mendeley.com/datasets/3ggxwf2vpr/2. Publisher page lists CC BY 4.0, seven indoor classes including door. Public file metadata was retrieved: `Indoor Objects.v1i.voc.zip`, 453,984,831 bytes, publisher SHA256 `3d5a25726f045f230eccbabfc9e3ef4db3916464dcda4d7f48102e7a9ababd20`. Direct file download returned HTTP 403; archive contents/images were NOT inspected or obtained. Need actual sample/provenance/duplicate/annotation-target review before approval. It does not claim four outer-frame corner labels or a window class.
- DeepDoors2: https://github.com/gasparramoa/DeepDoors2. Official README describes real RGB door/frame photos and detection/segmentation data, but no clear dataset license grant was found in that README; not approved for commercial training on that basis.

## Evaluated alternative: Google Open Images SSD MobileNet V2 — 2026-11-11
- Official owner statement explicitly licenses trained models Apache-2.0: https://storage.googleapis.com/openimages/web/extras.html
- Exact downloaded TF Hub archive and embedded SavedModel are SHA-pinned in `training/google_openimages_candidate.py`. Embedded source label names/MIDs confirm Door index 160 and Window index 485.
- A research ONNX file with full embedded license and modification/source records was produced (18,502,049 bytes); source code, pruning equivalence, synthetic train/restore/export, and offline WASM parity tested. It is not the active Door Live detector.
- Full evidence/limitations: `GOOGLE_OPENIMAGES_CHECKPOINT_EVALUATION.md`. Actual corner geometry, phone validation and target-specific fine-tuning remain pending. Backend substitution remains an explicit decision.
- 296 Open Images photographic candidates obtained with per-image metadata attribution/declared CC BY 2.0 licenses and local SHA256. Annotation license CC BY 4.0. Original publisher license pages, physical-scene grouping and corner labels remain unverified; no commercial-training approval granted automatically.

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
- Current session: CPU PyTorch 2.15.0+cpu and torchvision 0.29.2+cpu installed and executable; CUDA unavailable.
- Historical session downloads failed. Current session downloads from official GitHub now succeed; Nano checkpoint checksum and CPU inference are recorded in `training/reports/yolox_nano_preflight_2026_11_11.json`.
- Official COCO Nano initialization remains available. In addition, a licensed Google Door/Window-pretrained research candidate has now been exported and tested; no real-photo fine-tuning or active backend replacement has occurred.
- Next gate: legally permitted pretrained checkpoint and images must be accessible in a training environment; use a separate training machine/runner with authorized network and compute, not fake scratch-training results.

## Browser runtime
- Official ONNX Runtime Web: https://onnxruntime.ai/docs/get-started/with-javascript/web.html
- WASM: supported in iOS Safari and Chrome Android; WebGPU is not a safe universal dependency.
- Self-host JS and WASM version-pinned on origin; verify fallback, iOS memory footprint and performance before shipping.
