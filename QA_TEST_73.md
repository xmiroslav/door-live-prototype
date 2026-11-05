# Door Live — TEST 73 acceptance checklist

## Deployment boundary
- Browser viewer code and detector are on GitHub Pages.
- Existing Unidoors embed remains unchanged until the owner can edit the site.
- The viewer cannot guarantee receipt of a door image when opened directly rather than from the configurator.

## Required acceptance tests (real Chrome on iPhone)
1. Choose a door in Unidoors, tap the existing preview control, confirm that the selected design, handle, glazing, and frame match.
2. Upload a portrait photograph of a **closed** door. The photo must remain uncropped. If auto-detection succeeds, the four editable corners must be visible; adjust to outer jamb and floor.
3. Upload a photograph of an **open** doorway. If automatic detection fails, open existing Settings > Mark corners and tap TL, TR, BR, BL. The selected door must cover the whole opening, including its own frame.
4. Repeat with a wide-angle/landscape photo, tilted doorway, low-contrast white jamb, and a doorway with a window visible behind it. Do not claim automatic success without a real test.
5. Reopen Settings > Adjust corners, drag each handle; verify that changes remain visible and saving hides handles.
6. Switch between two room photos without losing the configured door image.
7. Return to live camera, background/foreground Chrome, restart camera; confirm there is no stale photo placement.
8. Test with poor or missing network; manual corner selection must remain possible without a detector response.

## Architectural boundaries
- Photo manual placement is authoritative and does not depend on detection.
- Photo detector proposes an editable quadrilateral, never a verified physical door.
- Detector timeouts must not permanently disable the worker.
- Perspective renderer maps the *entire captured door including jambs* into four outer-frame corners.
- Camera tracking is a separate stage and must not override photo/manual placement.
- Never invent a default door if the configurator transfer was expected.

## Known limitations
- No automated image-based recognition model or production-grade door segmentation has been added.
- The still-photo detector is a geometric heuristic; low contrast, clutter, nested frames, and severe perspective can still fail.
- The end-to-end Unidoors handoff requires testing with the currently embedded integration script.
- No real iPhone Chrome end-to-end run has been executed by this change.
