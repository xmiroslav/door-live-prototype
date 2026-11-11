# Initial 21-photo annotation integrity audit — 2026-11-11

Source ZIP: `door_live_training_dataset_21_complete.zip` (local research archive, **not committed to this repo**).

| Split | Count | Unverified | Invalid/out-of-image quadrilaterals |
|---|---:|---:|---:|
| train | 13 | 13 | 0 |
| val | 5 | 5 | 0 |
| test | 3 | 3 | 0 |
| total | 21 | 21 | 0 |

Validation checked only four points per sample, convex consistent ordering and image bounds. **This does not establish accurate localization.** The images and labels require human visual review.

No identical `group` strings appeared in more than one split; this is **not** proof that separate group labels represent different physical doorways. Similar groups `brown_A` and `brown_B` should be checked for scene leakage. Previous training used some of these images, so reported test accuracy must not be presented as an untouched blind benchmark.

## Action

1. Open `experimental-annotation-review.html` from branch preview or download locally.
2. Upload corresponding images from ZIP's `images/` folder and all three `exports/*_corners.json` files.
3. Inspect external casing coordinates, move corners, click **Разметка проверена** on each.
4. Export corrected JSON. Keep originals and record reviewer/date/permissions before training.
5. Acquire a genuinely blind test set of different physical doors to measure real generalization.

No training performed by this audit.
