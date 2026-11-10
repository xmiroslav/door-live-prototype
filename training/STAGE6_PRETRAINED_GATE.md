# Stage 6 — pretrained fine-tuning gate

The script `training/train_pretrained_detector.py` is a **runnable training entry point**, not evidence that a pretrained model has been fine-tuned.

It uses torchvision Faster R-CNN MobileNetV3-320 pretrained COCO weights as an **alternative candidate** to the previously proposed EfficientDet-Lite0. It requires a local matching weights file, deliberately does not silently download, refuses unverified labels unless explicitly overridden, and exports a door-frame **bounding-box detector only**. It does not estimate four corners or provide stable live tracking. Commercial license and dataset provenance must be verified for the exact weights.

Current source data: 21 provisional images. Stage 5's 3-photo test split is **not an independent test** of the older stage-2 tiny CNN because the older model may already have seen these images. Stage-6 evaluation of that tiny CNN against the provisional three-photo split returned mean normalized corner distance **0.03078**, but this is a contaminated diagnostic, **not** evidence of generalization.

No pretrained model weights were available in the local runtime and no pretrained training was performed. No app integration was changed.

Required next actions: verify labels, obtain authorized pretrained weights, fine-tune bounding-box detector, train a separate four-corner head, validate on unseen physical doorways, benchmark iPhone Safari and Android Chrome, then connect the experiment.
