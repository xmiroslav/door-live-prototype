# Batch 02–03 — user corrections received (2026-11-10)

**Do not request these corrections again.** The user supplied the corrected contact sheet `annotation_review(1).jpg` in the conversation. Green strokes show the previous candidate quads. **Red strokes are user corrections and take precedence wherever present.** The contact sheet is a visual source; do not claim its red pixels have already been converted into accurate original-resolution keypoints.

## Red-corrected cases to transcribe first
- `IMG_9688.jpeg`: open entry door; locate fixed outer trim, not moving leaf.
- `IMG_9687.jpeg`: closed light door; prior green quad included excess floor below frame.
- `IMG_9686.jpeg`: strongly oblique utility door; red follows true target rather than erroneous green candidate.
- `IMG_9684.jpeg`: oblique white utility door; do not confuse frame with adjacent architectural lines.

Other green-only samples on the sheet were not explicitly redrawn and **must not automatically be labeled user-verified**. Preserve original image identities and exact montage crop transforms when transcribing. Derive keypoints from corrected contours, not an axis-aligned rectangle or raw red-pixel bounding box. Mark each coordinate set as provisional until verified against full-resolution original images. No final training or deployment should silently substitute the old green labels for corrected red geometry.

## Next execution steps
1. Match each contact-sheet tile to the corresponding clean original image.
2. Recover each corrected red quadrilateral in tile coordinates and transform to the original image dimensions, checking crop/resize/padding.
3. Visually compare overlaid keypoints against originals and update JSON labels.
4. Retrain and evaluate on held-out physical doorway groups, not neighboring photos of the same door.

This file records **received corrections**, not a claim that a new model was trained.
