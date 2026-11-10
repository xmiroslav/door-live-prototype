# Stage 4 — reproducible comparison of existing research models

Date: 2026-11-10.

Two local TorchScript models were evaluated against the same six provisional held-out annotations, with the original full photos resized to 128×128 for model input.

| Model | Mean normalized corner distance | Worst image |
|---|---:|---:|
| Stage 2 (21-photo tiny CNN) | 0.08779 | 0.17700 |
| Stage 3 (12-epoch continuation) | 0.10788 | 0.18219 |

The smaller number is better. The stage 3 continuation degraded performance. These six images were reused for evaluation in earlier stages, so **this is not an independent final test**. All target annotations remain **unverified**, and neither model is a pretrained EfficientDet model or connected to live-camera tracking.

Visual comparison was generated locally: green = provisional annotations, yellow = stage 2, red = stage 3.

**Decision:** retain stage 2 as research baseline only. Do not integrate either into production. Obtain verified labels and independent unseen-doorway test data. Then acquire licensed pretrained weights and fine-tune a detector plus four-corner head. A generic COCO object detector does not directly output door-frame corners.

No working Door Live UI or camera code was changed during this evaluation.
