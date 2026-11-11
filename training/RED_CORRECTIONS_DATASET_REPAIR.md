# User corrections and 21-photo research export

The older `door_live_training_dataset_21_complete.zip` exports four older
quads for IMG_9688, IMG_9687, IMG_9686 and IMG_9684. They conflict with the
later user-redrawn contours transcribed in `BATCH_02_03_RED_CORRECTED_4.json`.
Never silently train using those older four targets.

`apply_red_corrections.py` copies the private dataset ZIP, replaces those
four corner targets, updates their COCO geometry, and unifies the corrected
physical-doorway group aliases before checking for cross-split leakage.
The source is preserved. All corrections remain provisional: their source is
the user-marked montage transcription and visibility has not been verified.
Neither this repair nor a successful integrity audit constitutes training or
demonstrates corner accuracy.

Run locally with source photos kept private:

```
python training/apply_red_corrections.py INPUT.zip training/BATCH_02_03_RED_CORRECTED_4.json OUTPUT.zip
python training/audit_local_dataset.py OUTPUT.zip
```

The corrected 21-photo export had 13 training, 5 validation, and 3 test
images; 0 verified labels, 0 structural errors, and 0 detected cross-split
near-duplicate pairs under the existing dHash audit. The test images have
been used previously and are not an independent final benchmark. Visual
near-duplicate detection does not prove absence of same-scene leakage.

Do not use `prepare_dataset.py` inside the archived source ZIP to regenerate
the exports without reapplying the corrections; it predates this repair.
The research ZIP contains user photographs and must not be committed to the
public repository. Rights, actual four-corner verification, pretrained
weights and model evaluation remain separate gates.
