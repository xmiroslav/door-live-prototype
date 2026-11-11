# Frozen pretrained feature corner probe — 2026-11-11

Research experiment, not a product model. It trains a linear ridge-regression
corner head on frozen features from the previously audited Google Open Images
Door/Window ONNX detector. The detector is not fine-tuned or integrated; this
full-image model does not select between multiple doors and has no calibrated
confidence or corner visibility. The earlier YOLOX architecture remains the
project baseline; this is a feasibility experiment using the approved Google
research candidate, not an architectural replacement.

Inputs: 13 corrected but unverified research photographs, plus their horizontal
flips; 5 validation and 3 test photographs from the prior 21-photo dataset. Both
holdouts were used in earlier work and are not independent final benchmarks.
Images from a physical doorway should remain in one split; existing group audits
do not prove that all similar scenes have been identified. Original image
rights, target correctness and occluded points remain unresolved.

For each corner, error is Euclidean pixel distance to the provisional target
divided by image diagonal; the table gives median over individual corners.

| Split | Photos | Median corner error | Mean of per-photo corner errors |
| --- | ---: | ---: | ---: |
| Train | 13 (26 with flips) | 0.11% | 0.13% |
| Validation | 5 | 2.82% | 3.67% |
| Test | 3 | 7.84% | 7.12% |

The gap indicates strong overfitting. None of these numbers is a reliable
measure against verified ground truth; the independent 2% acceptance target
has not been reached or measured. Model outputs are not suitable for automatic
door placement. No mobile browser speed or accuracy test was performed.

Generated ONNX SHA-256:
`56cc74e0ecf5d7f1592451b8b2e91668b70637be25f2f28bea4637f2163c97e3`.
One validation input matched the unexported head to maximum absolute error
2.98e-7 in native ONNX Runtime. The entire experiment ran with network access
denied and runtime telemetry disabled. Model, report and photos are kept
outside the public repository. Metadata and source checkpoint license remain
inside the output model; dataset usage and distribution rights still need
separate checks before commercial use.

Reproduce with the hash-pinned Google ONNX and corrected private dataset:

```
python training/run_without_network.py python training/pretrained_corner_probe.py --model MODEL.onnx --dataset DATASET.zip --output PRIVATE_OUTPUT
```

Requires Python packages `numpy`, `Pillow`, `onnx`, `onnxruntime` and seccomp
support from `run_without_network.py`. Do not put private photos in git.
Hyperparameters and augmentation were fixed before this run; no tuning is
claimed. Comparison to older models is not valid without matching splits,
labels, preprocessing and an independent test.
