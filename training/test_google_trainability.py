import importlib.util
import os
import unittest
from google_openimages_trainability import probe_trainability
from google_openimages_candidate import validate_source_labels

@unittest.skipUnless(os.environ.get('UNIDOORS_GOOGLE_SAVED_MODEL') and
                     all(importlib.util.find_spec(p) for p in ('tensorflow','tf2onnx','onnxruntime')),
                     'Use the TensorFlow candidate environment and audited SavedModel')
class GoogleTrainabilityTests(unittest.TestCase):
    def test_source_label_semantics_are_checked_before_export(self):
        from pathlib import Path
        from tensorflow.core.protobuf import saved_model_pb2
        proto=saved_model_pb2.SavedModel()
        proto.ParseFromString(Path(os.environ['UNIDOORS_GOOGLE_SAVED_MODEL']).read_bytes())
        validate_source_labels(proto)
        names=next(node for node in proto.meta_graphs[0].graph_def.node if node.name=='hub_input/Const')
        names.attr['value'].tensor.string_val[160]=b'Wrong class'
        with self.assertRaises(ValueError):validate_source_labels(proto)

    def test_pretrained_heads_update_restore_and_export_after_synthetic_step(self):
        result=probe_trainability(os.environ['UNIDOORS_GOOGLE_SAVED_MODEL'])
        self.assertEqual(result['trainable_predictor_tensors'],24)
        self.assertGreater(result['tensors_changed_after_step'],0)
        self.assertTrue(result['checkpoint_restored_exactly'])
        self.assertTrue(result['post_step_onnx_parity_passed'])
        self.assertFalse(result['real_photo_training_performed'])
        self.assertFalse(result['full_dataset_trainer_implemented'])

if __name__=='__main__':unittest.main()
