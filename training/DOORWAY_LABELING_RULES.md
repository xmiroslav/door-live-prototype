# Door Live AI — Ground truth, detection and projection specification
Version 1.0 — 2026-11-09

## Goal
Identify the *fixed architectural doorway* (jamb/frame/opening), not the moving door leaf, and project the exact selected Unidoors door into its plane. This document specifies desired behavior, **not** a trained model.

## Ground-truth object definitions
- `doorway_frame`: the fixed installation boundary (jambs and lintel). Include existing fixed frame when present. A door leaf can be open, closed, or absent.
- `door_leaf`: a separate movable panel; annotate only for training context, **never** use its corners as the placement quad.
- `negative`: windows, mirrors, wardrobes, picture frames, coat racks, rectangular wall decorations, and other non-door objects.
- `opening_state`: `closed`, `ajar`, `open`, `empty`, `unknown`. State is separate from the geometry target.
- `frame_visibility`: `clear`, `low_contrast`, `partially_occluded`, `heavily_occluded`.
- `frame_type`: `visible_trim`, `flush`, `frameless`, `unknown`.

## Four corners
Always annotate **TL, TR, BR, BL** in original unmirrored image coordinates, clockwise. These refer to the same *fixed planar installation boundary*, consistently across all images.
- TL: intersection of left fixed jamb and top fixed lintel.
- TR: intersection of right fixed jamb and top fixed lintel.
- BR: right fixed jamb at the finished-floor/threshold line.
- BL: left fixed jamb at the finished-floor/threshold line.
- The opening is a quadrilateral in the camera image. Do not force it to an axis-aligned rectangle or assume equal pixel lengths.
- The *installation plane* may be the inner jamb opening or outside edge of fixed trim depending on the selected Unidoors door's installation specification. Do not mix these conventions in training. Default annotation is **inner clear opening**; record outer trim as optional second quad. Calibration/fit parameters for selected door must use matching dimensions.
- If a corner is occluded by an open door leaf, label the **inferred** corner and set visibility=0; do not label the leaf edge instead.
- If the bottom is outside the image, mark bottom points unobservable; **do not fabricate precise ground truth**. Such images may be used for detection, but not full four-point supervised loss without explicit visibility masking.
- If frame is not confidently visible, label uncertainty and allow manual user correction.
- Each distinct physical doorway is a separate instance. Keep neighboring frames of the same doorway in the same train/validation/test split.

## Negative and ambiguous cases
- Rectangular windows with blinds and wardrobes are negative even if high contrast.
- A hallway with nested doors has multiple independent doorway instances; do not treat the inner distant doorway as the outer frame.
- Do not infer a door solely from handle/hinge presence. Use consistent vertical jambs, lintel, floor intersection, wall opening, and 3D scene context.
- Door leaf edge can overlap the jamb; annotate fixed jamb location rather than apparent moving edge.
- White-on-white: train exposure, shadow, low saturation and realistic contrast variants; preserve original labels. Do not manufacture unrealistic edge cues.
- Unlicensed/watermarked images are excluded from training unless usage rights are verified.

## Training data
Store original photos, per-image provenance and consent/license, original resolution, all doorway instances, 4 corners, per-corner visibility, opening_state, frame_visibility, frame_type, optional leaf polygon and negative distractor types.
Separate source location across train/validation/test; no near-duplicate leakage.
Initial seven-photo batch includes: open doors, partially open doors, a dark-trim empty opening, and a low-contrast closed white door. These are **not** yet a trained model.
Augment modestly with brightness, white balance, blur, perspective and realistic occlusion, keeping corner coordinates transformed correctly.
Prioritize more distinct locations and negative examples over dozens of near-identical frames.

## Model and browser execution
- Candidate architecture: Apache-2.0 MediaPipe Tasks Vision object detector + a separate trained four-keypoint model or geometry refiner. **MediaPipe ObjectDetector returns bounding boxes, not 4 corners**.
- Choose only weights whose **specific checkpoint** is cleared for commercial use. Track hash, upstream license, and training-data provenance.
- CPU/WASM on Safari and Android Chrome, with mobile memory/thermal benchmarking. No cloud per-frame API required.
- Maintain existing classical detector and manual adjustment as reliable fallback; never silently substitute a bounding box for a perspective quad.

## Projection of selected Unidoors door
1. Get the **actual selected door** from configurator: asset or composited transparent bitmap, orientation, frame/trim geometry, opening direction, handle, color, glass, aspect ratio and real-world width/height if available.
2. Preserve transparency; avoid including configurator UI, white padding, shadows outside intended panel, or unrelated page elements in the asset.
3. Map model doorway corners from source camera/photo pixels to displayed canvas pixels using actual object-fit crop, rotation, mirror and device pixel ratio. Do not mix coordinate spaces.
4. Use ordered source corners of the chosen door graphic (including matching frame extent) and destination TL/TR/BR/BL to compute a **projective homography**. Render with the existing perspective-correct projector; do not simply CSS-scale or rotate.
5. Match installation-plane conventions. A flat RGB photo can provide a 2D homography, **not guaranteed physical depth or millimeter-accurate installation**. Do not claim dimensional precision without calibration.
6. For open/ajar old door: selected new door is shown **closed in the fixed opening plane** by default; do not warp it onto the old moving leaf.
7. Handle occlusion: a fully opaque selected door may cover the old leaf; partial occlusion by foreground objects needs segmentation/depth and is not guaranteed. Avoid fake depth.
8. On live video, track fixed jamb features with optical flow/temporal filtering; periodic model redetection and outlier rejection. Avoid drift, snapping, inversion and jumping between multiple doors.
9. If confidence is low or tracking is lost, freeze briefly and offer 4-point correction; do not project a door on an unverified rectangle.
10. Save exactly the displayed composite at the requested resolution; do not replace selected asset with a generic door.

## Acceptance criteria — must be measured on held-out real device tests
- Initial detection target <= 4 seconds after camera is ready, including model initialization separately reported.
- Corner accuracy measured against manually verified inner-opening annotations, including perspective and low contrast.
- False positives evaluated on windows, closets, mirrors and coat racks.
- Stable tracking while walking and panning; report drift and relocalization failures.
- Compare original and AI engines on the *same* scenes. Keep both modes available.
- Do not promote AI mode until licensed model, actual 4-point output, device benchmark, and visual QA pass.
