# Door Live — first real training experiment (2026-11-09)

**Status: EXPERIMENT ONLY — DO NOT DEPLOY.**

A small PyTorch convolutional 4-corner regressor was trained from scratch locally on seven user-supplied door photos with approximate user-red outer-frame labels. Five images were used for training, two held out. Training ran for 80 epochs on CPU. This is **not MediaPipe/TFLite**, does not yet support multi-door detection, negative examples, or production camera inference.

Held-out test at 128x224 input resolution:
- IMG_9661.jpeg: mean corner error 70.53 pixels.
- IMG_9662.jpeg: mean corner error 16.59 pixels.
- Mean: 43.56 pixels.

These results fail the required geometric accuracy and are not representative due to tiny, related dataset and approximate labels. Do not turn on AI mode. Next steps: verify labels against clean original images, gather many independent doorways and negatives, select commercially cleared pretrained model, train detector + 4-corner model, export browser-compatible format, benchmark physical iPhone and Android.

Experiment checkpoint and visual comparisons are stored in the ChatGPT working artifact, not in GitHub. Training script is documented separately. No website files were modified by this experiment.
