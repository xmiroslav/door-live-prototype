# Experiment 006 — semantic mask prototype (2026-11-10)

A **real training run** tested a tiny U-Net-like semantic segmentation network on the existing provisional outer-frame polygon labels. Training: 10 photos (with geometric/color augmentation); held out: 4 photos from other physical doorway groups. CPU PyTorch, 128×224, six epochs. This run is an exploratory baseline, **not a production door detector**.

Best mean validation mask IoU: **0.273**. Per-image visual IoU approximately: IMG_9693 0.30, IMG_9692 0.34, IMG_9687 0.27, IMG_9684 0.17. **Failure:** predicted mask covers much of the image/background, not just the door. It cannot be used to select the correct doorway or derive installation corners.

The segmentation objective and current 10-photo training set are inadequate. Next: collect verified frame masks and hard negative/background samples; use pretrained commercially licensed object detector with ROI-specific mask/keypoint refinement, or a stronger model with much more diverse training data. Keep V4 as coordinate-regression experimental reference only; do not activate either model in live Door Live.

Local artifacts: `/mnt/data/door_semantic_v1/train.py`, `model.pt`, `heldout_segmentation.jpg`, `report.json`. The model was **not** exported to TFLite/MediaPipe. Existing web application is untouched.
