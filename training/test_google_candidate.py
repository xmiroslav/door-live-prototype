"""Real-model numerical pruning checks; no production detector switch."""
import importlib.util
import os
from pathlib import Path
import unittest

from google_openimages_candidate import prune_target_heads

@unittest.skipUnless(os.environ.get('UNIDOORS_GOOGLE_FULL_ONNX') and
                     all(importlib.util.find_spec(p) for p in ('onnx','onnxruntime')),
                     'Set UNIDOORS_GOOGLE_FULL_ONNX for actual source-model checks')
class GoogleCandidateTests(unittest.TestCase):
    def test_pruning_preserves_raw_door_window_scores_and_all_box_coordinates(self):
        import numpy as np
        import onnx
        import onnxruntime as ort
        ort.disable_telemetry_events()
        original=onnx.load(os.environ['UNIDOORS_GOOGLE_FULL_ONNX'])
        before=original.SerializeToString()
        reduced=prune_target_heads(original)
        self.assertEqual(original.SerializeToString(),before)
        self.assertLess(len(reduced.SerializeToString()),len(before)/2)
        options=ort.SessionOptions();options.intra_op_num_threads=2;options.inter_op_num_threads=1
        reference=ort.InferenceSession(before,sess_options=options,providers=['CPUExecutionProvider'])
        pruned=ort.InferenceSession(reduced.SerializeToString(),sess_options=options,providers=['CPUExecutionProvider'])
        for seed in (17,29):
            sample=np.random.default_rng(seed).random((1,300,300,3),dtype=np.float32)
            expected=reference.run(None,{'hub_input/image_tensor:0':sample})
            actual=pruned.run(None,{'hub_input/image_tensor:0':sample})
            self.assertEqual(actual[0].shape,(1,1917,4));self.assertEqual(actual[1].shape,(1,1917,2))
            for a,b in zip(expected,actual):np.testing.assert_allclose(a,b,rtol=1e-3,atol=1e-4)

    def test_class_coupled_output_cannot_be_pruned_as_independent_sigmoids(self):
        import onnx
        model=onnx.load(os.environ['UNIDOORS_GOOGLE_FULL_ONNX'])
        for node in model.graph.node:
            if node.name=='Postprocessor/convert_scores':node.op_type='Softmax'
        with self.assertRaises(ValueError):prune_target_heads(model)

    def test_missing_classifier_head_is_rejected(self):
        import onnx
        model=onnx.load(os.environ['UNIDOORS_GOOGLE_FULL_ONNX'])
        for node in model.graph.node:
            if node.op_type=='Conv' and '/ClassPredictor/' in node.name:
                node.name='unexpected_classifier_name';break
        with self.assertRaises(ValueError):prune_target_heads(model)

if __name__=='__main__':unittest.main()
