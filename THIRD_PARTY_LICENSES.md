# Third-party AI licensing audit — Door Live

Current architecture: `docs/LOCAL_AI_DELIVERY_CONTRACT.md`. This is a status inventory, not a shipping approval or the full distribution notices.

| Component | Intended use | Recorded status | Release gate |
| --- | --- | --- | --- |
| YOLOX-Nano implementation | Door/window candidate detection training | Upstream source Apache-2.0; pinned revision in `training/yolox_preflight.py` | Retain upstream copyright/license and applicable notices |
| Official YOLOX-Nano COCO checkpoint | Fine-tuning initialization | Downloaded and checksum tested; exact training/redistribution permission pending | Record checkpoint-specific evidence before training or shipping |
| Separate four-corner model | Outer frame including trim | Not trained | Verified supervised labels and reproducible artifacts |
| ONNX Runtime Web | Local mobile browser inference | Selected; distribution version not installed/pinned yet | Audit exact runtime/WASM distribution and bundle required licenses/notices |
| User 21-photo dataset | Initial corner/detector research | Provisional labels; per-image provenance/rights still need documented review | Verified outer-trim labels, physical-scene separation and permission record |
| Previously proposed Roboflow Door-Windows v1 | Rejected | Inspected cover and four samples are floorplans, not doorway photographs | Do not use for photo training; see source audit |
| Mendeley indoor dataset v2 | Candidate detector data | Publisher lists CC BY 4.0; metadata accessible, file download returned HTTP 403; samples uninspected | Confirm visual domain, provenance and label semantics before approval |
| Python training dependencies | Development only | Exact tested versions in `training/requirements-yolox-preflight.txt` | Audit redistribution if a training environment is distributed |

Sources and unresolved questions are recorded in `docs/MODEL_SOURCE_LICENSE_AUDIT.md`. Earlier OpenMMLab and EfficientDet candidates are superseded and are not selected dependencies.

`training/rights.example.json` is deliberately pending. Its fields validate the presence of review records bound to exact data/checkpoint hashes; they do not create legal permission.
