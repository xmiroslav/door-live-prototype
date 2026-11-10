# Door Live AI — semantic understanding of a single doorway (v1)

## Objective
Find the **fixed outer installation plane**, including visible frame/trim/architraves, for a single door. Return four ordered perspective corners TL, TR, BR, BL. A moving door leaf is never the target geometry. This specification supersedes any earlier instruction to label the inner clear opening as the default target.

## Positive evidence (soft cues, not hard requirements)
- Tall, roughly rectangular architectural structure; perspective makes its image outline a convex quadrilateral, not necessarily an axis-aligned rectangle.
- Two approximately upright jambs and a top lintel/trim, possibly partially occluded; bottom threshold or floor contact can be inferred when visible.
- A single coherent leaf surface may be present, but is not required. Wood grain, glass, panels, handles, signs, and ventilation grilles must not define the frame corners.
- Typical door proportions and contextual human scale are *priors only*, never fixed pixel-size or height constraints.
- Door and wall may have identical colors; geometry, edges, depth cues, and surrounding architecture matter more than color difference.
- Open, ajar, closed and absent leaf should map to the same fixed outer-frame corners for the same camera viewpoint.

## Perspective geometry
- Estimate four **independent** corner positions. Do not derive the final corners from an axis-aligned detection rectangle.
- A planar door assembly projects to a quadrilateral under camera perspective; opposite sides need not remain parallel in the image.
- Validate corner ordering, convexity, image bounds, nondegeneracy, and confidence. A geometrically valid quad may still be semantically wrong: validation is necessary, not sufficient.
- Apply a homography to the selected Unidoors door *assembly*, not just the leaf; preserve frame+trim in the asset.
- Handle camera lens distortion (wide-angle phones) separately when it materially bends otherwise straight edges; a single homography cannot correct nonlinear distortion.
- Do not assume every frame is exactly planar: deep jambs, unusual trims, and open leaves require segmentation/occlusion handling or manual adjustment.

## Learning targets
1. Single-door/frame candidate detection, with background negatives (windows, cabinets, mirrors, niches, wall panels, nearby empty spaces).
2. Four-corner keypoint localization of the **outer fixed trim**; label visibility and uncertainty per corner.
3. Door state (closed/ajar/open/empty opening) as an auxiliary cue, not the target.
4. Frame/leaf separation and confidence calibration; no automatic placement when uncertain.
5. Optional tracking across video frames, with stable anchors and no drift.

## Dataset and evaluation
- Use original unmarked photos as model inputs, and verified four-corner labels as targets. Colored correction overlays are reference only.
- Group splits by physical doorway/location to prevent leakage from multiple photos of one door.
- Oversample hard oblique angles, same-color wall/frame, open leaves, multiple architectural rectangles, and partly cropped trim.
- Measure per-corner error relative to frame size, quadrilateral overlap, failure rate, and stability on held-out physical doorways. Evaluate on iPhone Safari and Android Chrome.
- Initial scope: **single doors only**. Double doors are explicitly deferred to a later version; do not assume their center seam is the outer installation boundary.

## Implementation status
This is a semantic specification and training target, **not a trained model**. The current experimental PyTorch weights are not a production MediaPipe model. The existing heuristic Door Live mode must remain untouched until a separately validated AI model is ready.
