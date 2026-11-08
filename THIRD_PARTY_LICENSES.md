# Third-party AI licensing audit — Door Live

This document records a *planned* integration. It does not indicate that a model is deployed.

| Component | Intended use | License status | Release gate |
| --- | --- | --- | --- |
| OpenMMLab MMPose / RTMPose implementation | Four-corner keypoint training | Source code: Apache-2.0 | Retain required license and notices |
| OpenMMLab MMDetection / RTMDet implementation | Doorway candidate detection | Source code: Apache-2.0 | Retain required license and notices |
| RTMPose pretrained checkpoint | Fine-tuning initialization | **Not yet verified for this exact checkpoint** | Do not redistribute or deploy until confirmed |
| RTMDet pretrained checkpoint | Fine-tuning initialization | **Not yet verified for this exact checkpoint** | Do not redistribute or deploy until confirmed |
| ONNX Runtime Web | Browser inference | Check pinned distribution and bundled notices at integration time | Include applicable notices |
| Training images | Doorway training set | Per-image provenance required | Exclude unlicensed third-party imagery |

Source repositories:
- https://github.com/open-mmlab/mmpose
- https://github.com/open-mmlab/mmdetection
- https://github.com/open-mmlab/mmpose/issues/3273

Before release, pin exact package and checkpoint versions, record upstream links, hashes and license evidence, and add the full applicable license texts and NOTICE files. This checklist is not a substitute for the actual required notices.
