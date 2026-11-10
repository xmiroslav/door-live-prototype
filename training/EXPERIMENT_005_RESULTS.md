# Experiment 005 — independent corner heatmaps (2026-11-10)

Ran a **real** PyTorch CPU experiment with a four-channel heatmap head, differentiable soft-argmax coordinates, Gaussian target heatmaps, and image+corner projective augmentation. Trained 100 epochs on 10 photos and evaluated on the same four held-out photos/physical-doorway groups as V4 at 128×224.

- V4 held-out mean corner error: **11.60 px**
- V5 held-out mean corner error: **17.82 px** (best epoch 26)
- **Decision: reject V5**, retain V4 as experimental baseline. Heatmap formulation did not improve perspective performance on this dataset.

Artifacts: `door_live_ai_v5_experiment.zip` in conversation (training source, checkpoint, per-image predictions and visual comparison). Red annotations are still provisional and dataset is far too small to conclude generalization. The experiment does not include an object detector, MediaPipe runtime or TFLite conversion. Existing Door Live browser code remains unchanged.

**Next architecture iteration:** localized door candidate ROI followed by corner refinement, explicit edge/line evidence and perspective-heavy samples; avoid training a detector on only 14 labeled photos and do not overstate real-world accuracy.
