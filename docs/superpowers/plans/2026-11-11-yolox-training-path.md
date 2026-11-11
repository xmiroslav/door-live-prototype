# YOLOX Training Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the legacy Faster R-CNN-only preparation path with an executable, gated YOLOX-Nano fine-tuning path.
**Architecture:** Keep the approved detector + corner model + ONNX + tracking architecture. This increment implements only training inputs and YOLOX training/evaluation, using the pinned official experiment. No browser or classic-mode changes.
**Tech Stack:** Python, PyTorch CPU/CUDA, YOLOX, COCO JSON.
**Spec:** `docs/LOCAL_AI_DELIVERY_CONTRACT.md` and the user's approved seven-stage plan.

## Global Constraints
- Experimental branch only; classic mode unchanged.
- No production training from unverified annotations or uncleared checkpoint/data rights.
- Preserve all objects and negative images; never split one physical doorway across subsets.
- Validation metrics are distinct from final blind-test metrics.
- No door-trained or deployment claims from synthetic tests.

## Review Focus
- Negative images must remain in training and count false positives in validation.
- Multiple boxes per image must remain together.
- Tampered class mappings, corrupt dimensions and cross-split duplicate scenes must fail before training.
- Only the COCO classification predictor may be reinitialized during fine-tuning.
- Pending rights and unverified labels must fail closed without producing trained weights.

### Task 1: Dataset and permission gates
**Files:** `training/yolox_dataset.py`, `training/test_yolox_dataset.py`, `training/rights.example.json`.
**Interfaces:** `load_bundle(dataset_dir, images_dir)` returns split samples, shared ordered categories and input hashes; `check_training_rights(rights, checkpoint_sha256)` rejects pending evidence.
- [x] Write tests for negatives/multiple objects, group leakage, byte duplicates, category mismatch, unverified labels, invalid geometry and pending rights. Run RED.
- [x] Implement strict validation, preserving explicit existing splits and all image instances. Run GREEN.
- [x] Audit the real 21-image bundle; expected: reject all unverified labels.

### Task 2: Fine-tuning and validation
**Files:** `training/train_yolox.py`, `training/test_yolox_training.py`, training report/docs.
**Interfaces:** Consume Task 1 samples. Load pinned Nano pretrained checkpoint; replace only classification predictions. Input 416 square, BGR 0..255, upper-left letterbox 114. Targets are class/cx/cy/w/h in input pixels. Validation: one-to-one class-aware IoU >=0.5 matching, precision/recall and negative-image false positives at documented score/NMS thresholds.
- [x] Write RED tests for matching, preprocessing, complete state transfer and a real synthetic optimizer step.
- [x] Implement CPU/CUDA loop with finite-loss checks, deterministic seeds, explicit artifact metadata and validation per epoch. Run GREEN.
- [x] Prove the actual unverified bundle is blocked without weights output. Do not train it or claim accuracy.
- [x] Correct stale inner-opening labeling guidance to refer to the approved outer-trim contract; document actual blockers and commands.

## Execution record
- Existing dedicated clone on the experimental branch is retained; no main changes.
- The design and stage order were explicitly reconfirmed by the user before this increment.

## Verification ledger
- Task 1: dataset/rights tests observed failing before implementation, then passing. Actual 21-photo bundle rejected as unverified with no output directory.
- Task 2: preprocessing/metric tests observed failing before implementation; real Nano transfer + synthetic backward/optimizer passes. An initial test incorrectly expected the finest pyramid head to change for every object; measured gradients showed matching at coarser heads. The test now correctly requires at least one classification head to change.
- Full suite: 28 Python tests pass with actual upstream/checkpoint; JavaScript quad geometry tests pass.
- Full synthetic CPU CLI regression: 2 epochs, finite losses, validation, checkpoint/checksum/source snapshot written; no user photos used and no legal clearance implied.
- Independent review: no Critical/Important findings; provenance metadata suggestion implemented with repository commit/dirty state and saved source snapshot.
- CUDA remains untested. Upstream AMP deprecation warning remains; upstream pin unmodified.
- This increment completes training plumbing only. Legal clearance, verified real labels, trained door/corner models, ONNX export and mobile acceptance are still pending.
