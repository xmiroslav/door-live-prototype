# Experiment 004 — scale + translation + perspective (2026-11-10)

**Actually trained:** 75 epochs PyTorch CPU on 10 photos, evaluated on 4 held-out photos from groups brown_A, light3, utilityC. Input 128×224, normalized four-corner targets. Augmentation transforms image and corner labels together (projective perspective, scale, translation, horizontal flip, brightness). Best epoch 70.

- V3 mean corner error: 15.87 px at 128×224
- V4 mean corner error: **11.60 px at 128×224** (same held-out set; ~27% lower)
- Held-out per-image errors: IMG_9693 10.8 px; IMG_9692 9.0 px; IMG_9687 9.4 px; IMG_9684 17.2 px.

**Limitations:** The held-out set has only 4 photos from 3 physical doorway groups; labels are still provisional, and the model still misses perspective on IMG_9684. This is a coordinate regression baseline, **not** a trained door semantic detector or an integrated MediaPipe/TFLite model. No live browser mode is enabled. Do not interpret the error as real-world installation accuracy. Existing Door Live mode remains untouched.

Artifacts in ChatGPT conversation: `door_live_ai_experiment_v4.zip` with `train_v4.py`, `model_v4.pt`, `v4_report.json`, `v4_heldout.jpg`, and `corrected_annotations.json`. Next: verify red-label coordinates against full-resolution originals, expand unique doorway groups, add negative samples and candidate detection / corner head, then export and benchmark in browsers.
