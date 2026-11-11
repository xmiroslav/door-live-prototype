#!/usr/bin/env python3
"""Synthetic train/save/restore/export feasibility; NOT a real-data SSD trainer."""
import argparse
import json
from pathlib import Path
import tempfile

from google_openimages_candidate import SAVED_MODEL_SHA256, prune_target_heads, sha256, validate_source_labels


def probe_trainability(saved_model):
    import numpy as np
    import onnxruntime as ort
    ort.disable_telemetry_events()
    import tensorflow as tf
    import tf2onnx
    from tensorflow.core.protobuf import saved_model_pb2
    saved_model = Path(saved_model)
    if sha256(saved_model) != SAVED_MODEL_SHA256:
        raise ValueError('SavedModel does not match the audited Google checkpoint')
    proto = saved_model_pb2.SavedModel()
    proto.ParseFromString(saved_model.read_bytes())
    validate_source_labels(proto)
    source = proto.meta_graphs[0].graph_def
    graph = tf.Graph()
    config = tf.compat.v1.ConfigProto(intra_op_parallelism_threads=2, inter_op_parallelism_threads=1)
    with graph.as_default():
        variables, replacements = [], {}
        for node in source.node:
            if (node.op == 'Const' and node.name.startswith('BoxPredictor_')
                    and ('/ClassPredictor/' in node.name or '/BoxEncodingPredictor/' in node.name)
                    and node.attr['value'].tensor.dtype == tf.float32.as_datatype_enum):
                value = tf.make_ndarray(node.attr['value'].tensor)
                if value.ndim in (1, 4):
                    variable = tf.compat.v1.get_variable(
                        'finetune_' + str(len(variables)), initializer=value, use_resource=False)
                    replacements[node.name + ':0'] = variable.value()
                    variables.append(variable)
        if len(variables) != 24:
            raise ValueError('Expected 24 audited pretrained predictor weight/bias tensors')
        tf.import_graph_def(source, input_map=replacements, name='')
        input_name = 'hub_input/image_tensor:0'
        image = graph.get_tensor_by_name(input_name)
        raw_logits = graph.get_tensor_by_name('Postprocessor/scale_logits:0')
        target_logits = tf.gather(raw_logits, [160, 485], axis=2)
        # Synthetic zero class/encoding targets prove differentiability only.
        classification_loss = tf.reduce_mean(tf.nn.sigmoid_cross_entropy_with_logits(
            labels=tf.zeros_like(target_logits), logits=target_logits))
        regression_loss = tf.reduce_mean(tf.square(graph.get_tensor_by_name('concat:0')))
        loss = classification_loss + .01 * regression_loss
        train = tf.compat.v1.train.GradientDescentOptimizer(1e-3).minimize(loss, var_list=variables)
        tf.identity(tf.gather(graph.get_tensor_by_name('Postprocessor/raw_box_scores:0'),
                              [160, 485], axis=2), name='unidoors_scores')
        tf.identity(tf.clip_by_value(graph.get_tensor_by_name('Postprocessor/raw_box_locations:0'),
                                     0., 1.), name='unidoors_boxes')
        outputs = [graph.get_tensor_by_name('unidoors_boxes:0'), graph.get_tensor_by_name('unidoors_scores:0')]
        initialize = tf.compat.v1.global_variables_initializer()
        saver = tf.compat.v1.train.Saver(var_list=variables)
        erase = [variable.assign(tf.zeros_like(variable)) for variable in variables]
        with tf.compat.v1.Session(graph=graph, config=config) as session:
            session.run(initialize)
            sample = np.random.default_rng(13).random((1, 300, 300, 3), dtype=np.float32)
            before = session.run(variables)
            initial_loss = float(session.run(loss, {image: sample}))
            session.run(train, {image: sample})
            after = session.run(variables)
            final_loss = float(session.run(loss, {image: sample}))
            changed = sum(not np.array_equal(a, b) for a, b in zip(before, after))
            if changed == 0 or not np.isfinite(final_loss) or not all(np.isfinite(v).all() for v in after):
                raise RuntimeError('Synthetic optimizer step failed')
            with tempfile.TemporaryDirectory(prefix='google-synthetic-training-only-') as directory:
                checkpoint = str(Path(directory) / 'synthetic.ckpt')
                saver.save(session, checkpoint)
                session.run(erase)
                saver.restore(session, checkpoint)
                restored = session.run(variables)
                if not all(np.array_equal(a, b) for a, b in zip(after, restored)):
                    raise RuntimeError('Checkpoint restore mismatch')
                reference = session.run(outputs, {image: sample})
                frozen = tf.compat.v1.graph_util.convert_variables_to_constants(
                    session, graph.as_graph_def(), ['unidoors_boxes', 'unidoors_scores'])
    converted, _ = tf2onnx.convert.from_graph_def(
        frozen, input_names=[input_name], output_names=['unidoors_boxes:0', 'unidoors_scores:0'],
        shape_override={input_name: [1, 300, 300, 3]}, opset=17)
    reduced = prune_target_heads(converted)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    inference = ort.InferenceSession(reduced.SerializeToString(), sess_options=options,
                                    providers=['CPUExecutionProvider'])
    actual = inference.run(None, {input_name: sample})
    errors = []
    for expected, result in zip(reference, actual):
        np.testing.assert_allclose(expected, result, rtol=1e-3, atol=1e-4)
        errors.append(float(np.max(np.abs(expected - result))))
    return {'scope': 'Synthetic optimizer/checkpoint/ONNX feasibility only',
            'trainable_predictor_tensors': len(variables), 'tensors_changed_after_step': changed,
            'synthetic_loss_before': initial_loss, 'synthetic_loss_after': final_loss,
            'checkpoint_restored_exactly': True, 'post_step_onnx_parity_passed': True,
            'post_step_onnx_max_abs_errors': errors, 'real_photo_training_performed': False,
            'full_dataset_trainer_implemented': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saved-model', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    arguments = parser.parse_args()
    report = probe_trainability(arguments.saved_model)
    arguments.report.parent.mkdir(parents=True, exist_ok=True)
    arguments.report.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
