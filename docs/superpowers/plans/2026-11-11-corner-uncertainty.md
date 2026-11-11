# Per-corner uncertainty implementation plan

Approved by the user's “делай” following the per-corner confidence proposal. This increment implements the four-corner model contract and experimental projection gate, not real-photo training or production activation.

Spec: `docs/LOCAL_AI_DELIVERY_CONTRACT.md`, outer trim TL/TR/BR/BL, local inference, no classic-mode changes.

1. Add a compact PyTorch corner model producing `[N,4,H,W]` heatmap logits and `[N,4]` visibility logits. Loss must exclude hidden/out-of-crop corners from geometry supervision while learning their visibility. Test real forward/backward and hidden NaN-label handling.
2. Add browser decoder for fixed-order heatmap peaks, normalized spatial entropy, visibility scores and crop-to-image coordinates. These are uncalibrated model signals, not established correctness probabilities.
3. Add an experimental placement gate requiring validated model/calibration and rejecting any invisible, diffuse or crop-edge corner before existing quad validation. Thresholds remain research defaults until held-out calibration. Do not wire this into classic mode or pretend weights exist.
4. Tests: sharp/skewed quad maps correctly; one invisible corner blocks; one diffuse heatmap blocks; absent/nonfinite outputs fail closed; peaked but inverted quad rejected; unvalidated model/calibration cannot auto-place. Run Python suite and Node geometry tests, review, commit to the same experimental branch.

Status: code and synthetic verification complete. Legal/data gates for real training remain in force.

## Verification ledger
- New model/decoder tests first failed with missing modules; implemented actual model and decoder.
- A dedicated distant-two-peak test failed against entropy-only acceptance, then passed after adding 5x5 peak-region mass.
- A sigma=1.5 target-distribution test exposed too-strict entropy defaults; default changed to 0.5 so the declared synthetic training target can pass. This remains a research threshold pending held-out calibration.
- Independent review found no Critical/Important issues. Two extreme numeric cases were reported: all-hidden overflow and underflowing sigma. Both reproduced with failing tests and fixed; six model/loss tests now pass.
- Actual CPU ONNX export and numerical parity pass at rtol=1e-4 / atol=1e-5, with random weights only.
- Full Python suite: 35 tests pass with no skips when upstream/model environment variables are set. Both Node suites pass.
- Legacy ONNX exporter and upstream AMP deprecation warnings remain; no numerical/export failure.
- Classic and experimental UI files unchanged. New model weights are not trained or deployed; automatic model/calibration gates remain false until real validation.
