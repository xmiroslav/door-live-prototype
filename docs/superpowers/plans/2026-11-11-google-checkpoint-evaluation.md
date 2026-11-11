# Licensed pretrained checkpoint evaluation

Scope: G0 source/license/export feasibility and photo-data acquisition under the user's instruction to continue and propose better solutions. No active detector replacement or classic-mode changes.

Completed:
- Verify Google's explicit Apache-2.0 grant for trained Open Images models; pin downloaded SSD MobileNet V2 artifact and embedded class table.
- Run original source model on 21 user photos; record raw observations without claiming independent accuracy.
- Export fixed 300 RGB ONNX, reduce six classifier heads to Door/Window, compare raw results on all 21 photos.
- Verify ONNX Runtime Web/WASM numerical parity and timing on a Node host; do not call this a phone benchmark.
- Prove synthetic head optimization, exact checkpoint restore, frozen export and post-step ONNX parity under TensorFlow 2.20 compatibility APIs.
- Obtain 296 Open Images photos as an annotation pool with source attribution and hashes. No outer-trim corner labels or original-publisher license checks are fabricated.
- Preserve candidate ONNX with embedded license, photo proof and source-data checkpoint as user artifacts.
- Keep YOLOX as the agreed baseline until the detector replacement is explicitly chosen; no UI activation.

Verification/rulings:
- Initial native runtime probe was blocked by automatic review for background Microsoft telemetry. Native runtime entry points now set ORT_DISABLE_TELEMETRY=1 before initialization; non-essential events are additionally disabled via API.
- A namespace-based isolation attempt was unavailable in this environment. An unprivileged libseccomp runner now refuses new IPv4/IPv6 sockets and outbound connect/send operations before exec. Its kernel behavior is regression-tested; failure prevents child launch.
- Model tests and WASM probe rerun under this network-denied runner; local computation/export succeeds.
- Independent review found no Critical/Important issue. Semantic class-table validation was added to address its minor suggestion.
- Explicit limitations: SSD full-dataset trainer not implemented; no real-photo fine-tuning; bounding boxes are not outer-frame corners; photo/UI/camera integration and mobile benchmarks remain unfinished.

Final checks: main environment 39 passing + 2 TensorFlow-specific skips; separate TensorFlow environment 5 passing covering both skipped cases. Both Node suites and isolated WASM parity pass. Model/data/photo-proof artifacts saved successfully. No core app file was modified.
