# Live camera tracking experiment — TEST 87

Added `door-corner-tracker.js` and wired it to `experimental-phone-test.html`.

## What actually works in code
- Camera uses getUserMedia, remains on-device and releases tracks on stop/background.
- After a heuristic frame candidate or four manually selected outer corners, the new tracker samples successive frames and performs local patch matching around four corners.
- Updates quadrilateral at ~7 Hz while rendering the camera each animation frame.
- Marks tracking lost after repeated low-confidence samples and asks the user to reset.
- Classic `index.html` tracking and original system are unchanged.

## Not yet done
- No pretrained door detector trained or loaded.
- The prior 21-photo TorchScript research model is **not** integrated.
- No stable 3D world anchoring; patch matching can drift, especially on textureless frames, camera rotation, occlusion and large perspective changes.
- Experimental overlay is still a sample SVG, not the selected Unidoors layered product.
- No physical iPhone Safari / Android Chrome benchmark was performed.

## Required for real AI release
Verify corner annotations; acquire legally usable pretrained weights; train box + four-keypoint detector; export a browser-compatible model; integrate inference and confidence gating; add robust geometric tracking and actual product asset; test on independent doorways and mobile devices.

**Do not claim AI recognition is implemented.**
