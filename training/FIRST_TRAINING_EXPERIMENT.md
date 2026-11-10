# Door Live — first training experiment (2026-11-10)

**Actual training performed locally**, with 7 user-supplied door photos and provisional outer-frame quadrilaterals. This is a **small CNN trained from scratch**, **not EfficientDet**, **not a pretrained model**, and **not a browser-deployed model**. Do not label it AI-ready in the UI.

- Train: 5 photos, 8 mild augmentations each.
- Holdout: 2 photos from different views.
- 25 epochs, RGB 128x128, 8 normalized corner coordinates TL,TR,BR,BL.
- Epoch 1 holdout mean normalized corner distance: **0.3463**.
- Epoch 11: **0.1560**.
- Epoch 21: **0.1617**.
- Epoch 25: **0.1690**.
- Training MSE at epoch 25: **0.00067**.

The gap between low training error and poor holdout error indicates overfitting. **This is not sufficient for automatic positioning.** Labels are unverified rough approximations of the user's red markings; 7 photos are far too few for reliable recognition. No commercial model or accurate live camera tracking has been produced.

Local artifacts created: door_quad_poc.pt, door_quad_poc.torchscript.pt, training_report.json, and train_door_quad_poc.py. Binary model artifacts were not pushed to this GitHub repository. Do not confuse this first proof-of-concept with the selected future architecture (EfficientDet-Lite0 + learned keypoints).

**Next gates:** verify all 7 red contours against original photos, obtain more unique doorways with 4-point labels, review EfficientDet model artifact license, fine-tune pretrained detector, train keypoint regressor, export TFLite / compatible browser runtime, test real iPhone/Android, and only then replace heuristic auto-detection.

The outer fixed frame and trim (not moving door leaf) is the target even for open doors.
