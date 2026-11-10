# Stage 2: 21-photo provisional corner experiment (2026-11-10)

This experiment **was trained**, but it is **NOT** the chosen pretrained EfficientDet-Lite0 production architecture. It is a small CNN trained from scratch on unverified provisional labels. **Do not deploy or advertise it as working AI.**

- Total images: 21
- Train images: 15; held-out: 6
- Held-out groups: brown_A, storage, IMG_9661 (no images from these groups in training)
- Training: 24 epochs, 128x128 RGB, simple flips/brightness/contrast
- Outputs: normalized four outer-frame corners (TL, TR, BR, BL)
- Metric: mean normalized Euclidean corner distance from provisional labels, NOT accuracy percentage.

| Epoch | Train MSE | Held-out mean corner distance |
|---:|---:|---:|
| 1 | 0.07369 | 0.3358 |
| 8 | 0.00230 | 0.0799 |
| 16 | 0.00103 | 0.0915 |
| 24 | 0.00073 | 0.0878 |

Best observed checkpoint metric is at epoch 8, **not epoch 24**. The 24-epoch artifact was saved; no model-selection checkpoint was saved at epoch 8. The widening gap indicates overfitting/instability. The held-out labels are not user-verified ground truth, so this metric cannot establish real-world positioning accuracy.

Generated local files: door_ai_stage2/door_quad_21_provisional.pt, door_quad_21_provisional.torchscript.pt, stage2_training_report.json, holdout_predictions_vs_labels.jpg. These files were generated in the working container and not deployed to GitHub Pages.

**Still missing:** verified outer-trim annotations, a licensed pretrained detector model and its fine-tuning, a trained four-corner model with reliable validation, browser-compatible inference, live camera motion tracking, and on-device tests.

See docs/FINAL_AI_ARCHITECTURE.md for the intended production design.
