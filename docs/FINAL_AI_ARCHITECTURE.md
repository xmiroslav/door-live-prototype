# Door Live — selected architecture (reconfirmed 2026-11-11)

The authoritative requirements and stage gates are in [LOCAL_AI_DELIVERY_CONTRACT.md](LOCAL_AI_DELIVERY_CONTRACT.md).

1. **Detector:** YOLOX-Nano, fine-tuned on permitted door/frame/window data. Official stock COCO weights do not detect these classes.
2. **Geometry:** a separate small four-keypoint model, supervised on outer fixed frame **including trim**, ordered TL/TR/BR/BL. Bounding boxes are not installation quads.
3. **Runtime:** self-hosted ONNX Runtime Web with WASM baseline on iPhone Safari and Android Chrome. No Roboflow/cloud inference.
4. **Projection:** the actual selected Unidoors composite door via homography and explicit matching of asset/frame boundaries.
5. **Camera:** visual tracking plus periodic redetection; camera work follows a verified photo-placement prototype. No claim of world anchoring from two-frame tracking.
6. **Fallback:** manual correction. Classic mode stays unchanged until new mode passes validation.

## Current executable work

- Official YOLOX-Nano checkpoint downloaded and strict CPU inference verified; not commercially cleared and not door-trained.
- `training/train_yolox.py` implements the selected fine-tuning path with annotation, data-integrity and permission gates. See `training/YOLOX_TRAINING.md`.
- All 21 current photo labels remain unverified; they are blocked from training by default. No override is provided in this path.
- Corner model, deployed ONNX door models, verified photo placement and reliable camera tracking remain unfinished.

Older RTMDet, RTMPose and EfficientDet proposals are historical. They are not alternate active implementations.
