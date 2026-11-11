"""Numerical export test on random weights; not door-recognition validation."""
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest

os.environ['ORT_DISABLE_TELEMETRY'] = '1'

@unittest.skipUnless(all(importlib.util.find_spec(name) for name in ('torch','onnx','onnxruntime')),
                     'Install PyTorch, ONNX and ONNX Runtime for export parity test')
class CornerOnnxTests(unittest.TestCase):
    def test_cpu_onnx_outputs_match_pytorch_for_fixed_crop_contract(self):
        import numpy as np
        import onnx
        import onnxruntime as ort
        ort.disable_telemetry_events()
        import torch
        from corner_model import DoorCornerModel
        torch.manual_seed(19);torch.set_num_threads(2)
        model=DoorCornerModel().eval()
        sample=torch.rand(1,3,256,256)
        with torch.inference_mode():expected=model(sample)
        with tempfile.TemporaryDirectory(prefix='unidoors-corner-export-') as directory:
            path=Path(directory)/'untrained-test-only.onnx'
            torch.onnx.export(model,sample,str(path),input_names=['rgb_crop'],
                              output_names=['corner_heatmaps','corner_visibility'],
                              opset_version=17,dynamo=False)
            onnx.checker.check_model(str(path))
            session=ort.InferenceSession(str(path),providers=['CPUExecutionProvider'])
            actual=session.run(['corner_heatmaps','corner_visibility'],{'rgb_crop':sample.numpy()})
            self.assertEqual(actual[0].shape,(1,4,64,64))
            self.assertEqual(actual[1].shape,(1,4))
            for reference, exported in zip(expected,actual):
                np.testing.assert_allclose(reference.numpy(),exported,rtol=1e-4,atol=1e-5)

if __name__=='__main__':unittest.main()
