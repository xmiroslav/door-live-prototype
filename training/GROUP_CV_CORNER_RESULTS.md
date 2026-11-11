# Group-aware corner probe — 2026-11-11

This is a research follow-up to `PRETRAINED_CORNER_PROBE_RESULTS.md`, not a
new production model or independent evaluation. The previous fixed penalty
was 100. We tested six ridge penalties (100 to 10,000,000) using leave-one-
doorway-group-out cross-validation on the 13 training photos only. Both the
original and horizontal flip of each photo stay in the same fold. Feature
scale is recomputed from each fold's training portion. There are eight groups;
errors are averaged equally across groups. All images currently have the same
864x1536 dimensions and their annotations remain provisional.

| Penalty | Mean group corner error / image diagonal |
| ---: | ---: |
| 100 | 7.237% |
| 1,000 | 7.257% |
| 10,000 | 7.531% |
| 100,000 | 7.781% |
| 1,000,000 | 7.808% |
| 10,000,000 | 7.811% |

The selected 100 is the original setting; the resulting ONNX SHA-256 is
unchanged (`56cc74e0ecf5d7f1592451b8b2e91668b70637be25f2f28bea4637f2163c97e3`).
The previously recorded validation and test metrics therefore do not improve.
The 8-group cross-validation is itself small, uses unverified labels and the
grouping is not a guarantee that every physical doorway is correctly grouped.
Holdout photos have appeared in previous experiments and remain unsuitable as
a final independent test. No model is approved for automatic placement.

The 21 overlaid source photographs were visually inspected at reduced scale.
Some lower corners are occluded or close to image edges; this inspection is
not full-resolution ground-truth approval. The first 56 Door-labelled photos
from the 296-image Open Images pool were also visually scanned at thumbnail
size; numerous scenes are cars, exterior scenes or have small doors. This is
not a full dataset review or a count of usable images. The Open Images boxes
are not four-corner trim annotations and their source rights need checking.

To repeat, use the previous experiment's command and add `--select-penalty`.
The classic application and live camera have not been changed.
