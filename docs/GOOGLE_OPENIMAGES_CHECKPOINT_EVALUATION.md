# Google Open Images checkpoint — evaluated alternative, not active backend

## Why investigate this candidate

The approved YOLOX-Nano baseline remains blocked on exact checkpoint permission and starts from COCO, which does not include Door/Window detection classes. The user's plan permits an alternative initialization/detector if the weight gate cannot be cleared, while retaining separate corners, ONNX, projection and tracking.

Google's official Open Images Extras page explicitly lists the SSD MobileNet V2 trained model and states that the models are released under Apache 2.0:
https://storage.googleapis.com/openimages/web/extras.html

The downloaded artifact is the official TensorFlow Hub Open Images V4 SSD MobileNet V2 module. This is a **pretrained object detector**, not a random network. Its embedded class tables map source index 160 to Door (`/m/02dgv`) and 485 to Window (`/m/0d4v4`). Both name and MID mappings are checked by the exporter.

This evaluation does not silently replace YOLOX or modify the classic/experimental UI. A backend choice and subsequent real-photo/mobile acceptance remain necessary.

## Exact artifacts and transformations

- Source: `https://tfhub.dev/google/openimages_v4/ssd/mobilenet_v2/1?tf-hub-format=compressed`
- Source archive SHA256: `bbdc9c5d34db1bbdcdf360a698ee3c7bc6f1346abec99aa40cbc018acd94bcf2`
- SavedModel SHA256: `9f49e034537b2518001794019869df0710f3089b0859ff10600408931a6a1895`
- Shared research ONNX: `DoorLive_Google_OpenImages_Door_Window_Research.onnx`
- Research ONNX SHA256: `9f80310593a35585d2e3c4681f5afed7a4a9c1b548977a46305ccf61387eccd6`
- Research ONNX size: 18,502,049 bytes, including full Apache license text and source/modification metadata.

Export removes full multi-class NMS/string lookup and returns raw proposals. Six classification convolutions retain only Door/Window filters for each anchor; regression and feature weights remain unchanged. This is valid because the source uses independent sigmoid scores. Softmax class coupling is explicitly rejected by the transform.

Unpruned ONNX was 57,801,596 bytes; the first pruned graph was 18,489,449 bytes. On all 21 user photos, pruned raw boxes/scores matched the unpruned exported graph exactly in the observed run (max absolute difference 0). TensorFlow-to-ONNX and WASM-to-native differences were below 1e-6. These are **numerical-equivalence results**, not detection-accuracy results.

## Input/output contract

- Input `hub_input/image_tensor:0`: float32 `[1,300,300,3]`, RGB 0..1, full image stretched to square. Reproduce the declared bilinear preprocessing; do not use YOLOX's BGR tensor.
- `unidoors_boxes:0`: float32 `[1,1917,4]`, normalized y_min/x_min/y_max/x_max, clipped to [0,1]. These are raw candidates before class-wise score filtering/NMS.
- `unidoors_scores:0`: float32 `[1,1917,2]`, independent Door/Window scores in that order.
- For the photo demonstration only: 0.30 score threshold, per-class NMS IoU 0.60. These are exploratory settings, not calibrated project acceptance thresholds.
- Door boxes may follow the moving leaf. Frame/trim localization and open/empty-frame recognition still need target-specific training and the separate corner model. Never map a selected door directly onto a raw detection rectangle.

## Measurements and actual limitations

The original model was run locally on all 21 supplied photos. Door confidence varied widely; an open/empty-frame example produced no Door candidate above the demonstration threshold. The delivered ONNX candidate with declared 300px bilinear preprocessing produced a Door candidate >=0.30 on 11 of the 21 photos. This is a thresholded observation, not recall or accuracy: outer-trim labels remain unverified and these photos are not a fresh blind benchmark. The displayed photo proof is generated from that exact delivered ONNX file.

ONNX Runtime Web 1.31.1, WASM SIMD, one thread, Node.js desktop host, final delivered research artifact:
- initialization about 673 ms;
- measured inference runs about 122, 93, 68 and 84 ms;
- maximum absolute differences vs native reference: boxes 3.58e-7; scores 5.36e-7.

This is **not Safari/iPhone or Android Chrome benchmarking**. Real phone cold load, memory, heat, latency and accuracy remain untested.

## Trainability checked, dataset training still absent

The TF Hub artifact freezes weights as constants. `google_openimages_trainability.py` reconnects the 24 original predictor weight/bias tensors to trainable variables under TensorFlow 2.20 compatibility APIs. A synthetic optimizer step changed 20 tensors, checkpoint restoration matched exactly, and the updated graph was frozen/exported with ONNX parity below 1e-6.

No legacy TensorFlow 1 installation or remote inference service was needed for this feasibility check. Compatibility/export APIs are deprecated, so the tested environment must be pinned. A complete SSD dataset trainer, anchor matching/loss design, real-data validation and model-update integration are **not yet implemented**. This probe proves a trainable/exportable path, not completed fine-tuning.

## New annotation pool

296 actual photographs downloaded from the official CVDF Open Images bucket; four selected source downloads returned HTTP 503. Of the successful photos, 168 have Door source boxes and 195 have Window source boxes (overlap is possible).

Source selection: validation metadata, declared CC BY 2.0 image license, known zero rotation; human box confidence 1; depictions and group boxes excluded; deterministic order with Door-containing scenes first. Attribution/title/original landing URL, source boxes, dimensions and local SHA256 are retained for each photo.

This is `DoorLive_OpenImages_296_Annotation_Pool.zip`, an **annotation pool**, not a verified 296-image outer-trim dataset. There are no invented corner labels, no automatic `verified=True`, and no implicit guarantee that Window-only boxes mean Door is absent. Scene-group/near-duplicate review and genuinely independent test images are still needed.

Official annotation/image-license details:
https://storage.googleapis.com/openimages/web/factsfigures_v7.html#licenses

Google licenses annotations CC BY 4.0 and lists images as CC BY 2.0, but requests original-image license verification. Per-image Open Images license records were retained; original publisher pages have NOT been individually rechecked. Commercial-training approval remains false.

## Reproduce model and tests

```bash
export ORT_DISABLE_TELEMETRY=1
python -m venv /tmp/door-google-env
/tmp/door-google-env/bin/python -m pip install -r training/requirements-google-candidate.txt
curl -fL 'https://tfhub.dev/google/openimages_v4/ssd/mobilenet_v2/1?tf-hub-format=compressed' -o /tmp/google-oid-source.tar.gz
curl -fL https://raw.githubusercontent.com/tensorflow/models/master/LICENSE -o /tmp/google-models-LICENSE.txt
python training/run_without_network.py /tmp/door-google-env/bin/python training/google_openimages_candidate.py \
  --source-archive /tmp/google-oid-source.tar.gz \
  --license-file /tmp/google-models-LICENSE.txt --output /tmp/google-door-window-research.onnx
```

Use `google_openimages_trainability.py --saved-model ... --report ...` for the synthetic train/restore/export probe. `test_google_candidate.py` accepts `UNIDOORS_GOOGLE_FULL_ONNX` pointing to the original two-class export before weight pruning; `test_google_trainability.py` accepts `UNIDOORS_GOOGLE_SAVED_MODEL` pointing to the audited SavedModel. Keep all real photos, checkpoints and tensor samples outside the public repository.

For WASM: install `onnxruntime-web@1.31.1` in a separate research environment, make it available through Node's module path, and run `training/probe_google_wasm.cjs MODEL INPUT_FLOAT32 NATIVE_BOXES_FLOAT32 NATIVE_SCORES_FLOAT32 REPORT_JSON` under `run_without_network.py`. It checks actual output parity, not just session creation.

## Privacy handling during development

An initial native ONNX Runtime probe was stopped by automatic review because its default build attempted Microsoft telemetry. Native entry points now set `ORT_DISABLE_TELEMETRY=1` before initialization and additionally disable non-essential events via API. Model checks and the final WASM probe were rerun with new IP sockets and connect/send operations denied by a tested unprivileged libseccomp runner. If that runner cannot install its filter, it does not start the child.

Official runtime documentation distinguishes telemetry-free WebAssembly from telemetry-enabled native builds and documents the pre-initialization environment switch:
https://github.com/microsoft/onnxruntime/blob/main/docs/Privacy.md

## Decision still open

This candidate removes the lack of a model-owner license statement and supplies actual Door/Window pretraining plus a demonstrated train/export/WASM path. It is a concrete alternative to the blocked YOLOX initialization, not a completed Door Live system. Selecting it would change only the detector component; the corner model, ONNX Runtime Web, actual Unidoors composite, homography, tracking and fallback requirements remain in place.

## Final verification coverage

The main Python environment ran 41 tests: 39 passed and two TensorFlow-specific cases were skipped there. A separate network-denied TensorFlow environment passed all five Google tests, including both skipped cases. Both existing Node geometry/evidence suites and the network-denied WASM probe passed. No skipped case is presented as having run in the wrong environment.
