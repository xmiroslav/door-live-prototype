#!/usr/bin/env python3
"""Isolated checkpoint evaluation, not an active Door Live detector replacement.

Official Google Open Images SSD MobileNet V2 -> two-class raw-proposal ONNX.
Only classifier filters are reduced; no retraining or four-corner claim.
"""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import tarfile
import tempfile

# Must precede any native ONNX Runtime initialization, including transitive imports.
os.environ['ORT_DISABLE_TELEMETRY'] = '1'

ARCHIVE_URL = 'https://tfhub.dev/google/openimages_v4/ssd/mobilenet_v2/1?tf-hub-format=compressed'
ARCHIVE_SHA256 = 'bbdc9c5d34db1bbdcdf360a698ee3c7bc6f1346abec99aa40cbc018acd94bcf2'
SAVED_MODEL_SHA256 = '9f49e034537b2518001794019869df0710f3089b0859ff10600408931a6a1895'
LICENSE_EVIDENCE = 'https://storage.googleapis.com/openimages/web/extras.html'
CLASS_INDICES = (160, 485)


def validate_source_labels(proto):
    nodes = {node.name: node for node in proto.meta_graphs[0].graph_def.node}
    names = nodes['hub_input/Const'].attr['value'].tensor.string_val
    mids = nodes['hub_input/Const_1'].attr['value'].tensor.string_val
    expected = ((b'Door', b'/m/02dgv'), (b'Window', b'/m/0d4v4'))
    for index, semantic in zip(CLASS_INDICES, expected):
        if index >= len(names) or index >= len(mids) or (names[index], mids[index]) != semantic:
            raise ValueError('Embedded source label table does not match Door/Window indices')


def sha256(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def prune_target_heads(source):
    """Preserve Door/Window scores exactly by slicing each anchor's classifier.

    This transform is specific to the pinned source and its independent sigmoid
    outputs. It is NOT valid for softmax classifiers. Six source heads have
    anchor-major groups of 603 output channels, including background/dummy classes.
    """
    import numpy as np
    import onnx
    from onnx import helper, numpy_helper
    model = copy.deepcopy(source)
    nodes = model.graph.node
    score_nodes = [n for n in nodes if n.name == 'Postprocessor/convert_scores']
    if len(score_nodes) != 1 or score_nodes[0].op_type != 'Sigmoid':
        raise ValueError('Expected independent source sigmoid class scores')
    heads = [n for n in nodes if n.op_type == 'Conv' and '/ClassPredictor/' in n.name]
    reshapes = [n for n in nodes if n.op_type == 'Reshape'
                and n.name.startswith('BoxPredictor_') and n.name.endswith('/Reshape_1')]
    if len(heads) != 6 or len(reshapes) != 6:
        raise ValueError('Expected six source classification heads and reshapes')
    gather = [n for n in nodes if list(n.output) == ['unidoors_scores:0']]
    if len(gather) != 1 or gather[0].op_type != 'Gather':
        raise ValueError('Expected explicit Door/Window gather output')
    initializers = {tensor.name: tensor for tensor in model.graph.initializer}
    if not np.array_equal(numpy_helper.to_array(initializers[gather[0].input[1]]), CLASS_INDICES):
        raise ValueError('Source class selection differs from the audited Door/Window mapping')
    for node in heads:
        weights = numpy_helper.to_array(initializers[node.input[1]])
        bias = numpy_helper.to_array(initializers[node.input[2]])
        if (weights.ndim != 4 or weights.shape[2:] != (1, 1)
                or weights.shape[0] not in (3 * 603, 6 * 603)
                or bias.shape != (weights.shape[0],)):
            raise ValueError('Unexpected source classifier shape')
        anchors = weights.shape[0] // 603
        indices = np.array([anchor * 603 + cls for anchor in range(anchors) for cls in CLASS_INDICES])
        for name, values in ((node.input[1], weights[indices].copy()),
                             (node.input[2], bias[indices].copy())):
            initializers[name].CopyFrom(numpy_helper.from_array(values, name=name))
    for node in reshapes:
        name = node.name + '/door_window_shape'
        model.graph.initializer.append(numpy_helper.from_array(np.array([1, -1, 2], dtype=np.int64), name=name))
        node.input[1] = name
    final = gather[0]
    obsolete_indices = final.input[1]
    final.CopyFrom(helper.make_node('Identity', [final.input[0]], ['unidoors_scores:0'],
                                    name='unidoors_scores_identity'))
    if not any(obsolete_indices in node.input for node in nodes):
        for tensor in list(model.graph.initializer):
            if tensor.name == obsolete_indices:
                model.graph.initializer.remove(tensor)
    # Old inferred intermediate channel dimensions refer to 603, not two.
    model.graph.ClearField('value_info')
    onnx.checker.check_model(model)
    return model


def build_candidate(archive, license_file, output):
    import onnx
    import tensorflow as tf
    import tf2onnx
    from tensorflow.core.protobuf import saved_model_pb2
    archive, license_file, output = Path(archive), Path(license_file), Path(output)
    if sha256(archive) != ARCHIVE_SHA256:
        raise ValueError('Source archive SHA256 does not match the audited Google artifact')
    license_text = license_file.read_text()
    if 'Apache License' not in license_text or 'Version 2.0, January 2004' not in license_text:
        raise ValueError('Supply the full Apache-2.0 license text')
    if output.exists():
        raise ValueError('Output already exists; preserve the prior research artifact')
    with tempfile.TemporaryDirectory(prefix='door-google-candidate-') as directory:
        temporary = Path(directory)
        with tarfile.open(archive) as source:
            if set(source.getnames()) != {'saved_model.pb', 'tfhub_module.pb'}:
                raise ValueError('Unexpected source archive members')
            source.extractall(temporary, filter='data')
        saved = temporary / 'saved_model.pb'
        if sha256(saved) != SAVED_MODEL_SHA256:
            raise ValueError('SavedModel SHA256 mismatch')
        proto = saved_model_pb2.SavedModel()
        proto.ParseFromString(saved.read_bytes())
        validate_source_labels(proto)
        graph = tf.Graph()
        with graph.as_default():
            tf.import_graph_def(proto.meta_graphs[0].graph_def, name='')
            raw_scores = graph.get_tensor_by_name('Postprocessor/raw_box_scores:0')
            raw_boxes = graph.get_tensor_by_name('Postprocessor/raw_box_locations:0')
            tf.identity(tf.gather(raw_scores, list(CLASS_INDICES), axis=2), name='unidoors_scores')
            tf.identity(tf.clip_by_value(raw_boxes, 0., 1.), name='unidoors_boxes')
            graph_def = graph.as_graph_def()
        model, _ = tf2onnx.convert.from_graph_def(
            graph_def, input_names=['hub_input/image_tensor:0'],
            output_names=['unidoors_boxes:0', 'unidoors_scores:0'],
            shape_override={'hub_input/image_tensor:0': [1, 300, 300, 3]}, opset=17)
        model = prune_target_heads(model)
        onnx.helper.set_model_props(model, {
            'license': 'Apache-2.0', 'license_text': license_text,
            'publisher': 'Google / Open Images', 'source_url': ARCHIVE_URL,
            'source_archive_sha256': ARCHIVE_SHA256,
            'license_evidence_url': LICENSE_EVIDENCE,
            'classes': json.dumps(['Door', 'Window']),
            'source_class_indices': json.dumps(CLASS_INDICES),
            'modifications': 'Fixed batch/RGB 300 input; raw clipped boxes; independent Door/Window class filters retained; original pretrained weights otherwise unchanged.',
            'status': 'Research candidate. No outer-frame corner model, fine-tuning, phone validation or active application integration.'})
        onnx.checker.check_model(model)
        output.parent.mkdir(parents=True, exist_ok=True)
        onnx.save(model, output)
    return {'file': output.name, 'bytes': output.stat().st_size, 'sha256': sha256(output),
            'source_archive_sha256': ARCHIVE_SHA256, 'license': 'Apache-2.0',
            'license_evidence': LICENSE_EVIDENCE, 'door_live_backend_changed': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-archive', type=Path, required=True)
    parser.add_argument('--license-file', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = build_candidate(args.source_archive, args.license_file, args.output)
    args.output.with_suffix('.manifest.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
