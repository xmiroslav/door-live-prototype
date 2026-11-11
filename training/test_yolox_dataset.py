import copy
import json
import subprocess
import sys
from pathlib import Path
import tempfile
import unittest
from PIL import Image
from yolox_dataset import load_bundle, check_training_rights


def make_bundle(root):
    images = root / 'images'
    exports = root / 'exports'
    images.mkdir(); exports.mkdir()
    for index, split in enumerate(('train', 'val', 'test')):
        name = split + '.png'
        Image.new('RGB', (100, 160), (30 + index * 40, 50, 70)).save(images / name)
        coco = {'images': [{'id': 1, 'file_name': name, 'width': 100, 'height': 160}],
                'categories': [{'id': 7, 'name': 'outer_door_frame_with_trim'}],
                'annotations': [{'id': 1, 'image_id': 1, 'category_id': 7,
                                 'bbox': [10, 20, 60, 120], 'iscrowd': 0}]}
        (exports / f'{split}_coco.json').write_text(json.dumps(coco))
        (exports / f'{split}_corners.json').write_text(json.dumps([
            {'file': name, 'group': split + '_physical_scene', 'verified': True,
             'width': 100, 'height': 160}]))
    return exports, images


def edit(path, change):
    data = json.loads(path.read_text()); change(data); path.write_text(json.dumps(data))


class DatasetGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.exports, self.images = make_bundle(self.root)

    def test_preserves_negative_images_and_all_objects(self):
        edit(self.exports / 'train_coco.json', lambda c: c['annotations'].append(
            {'id': 2, 'image_id': 1, 'category_id': 7, 'bbox': [70, 20, 20, 100], 'iscrowd': 0}))
        edit(self.exports / 'val_coco.json', lambda c: c.update(annotations=[]))
        bundle = load_bundle(self.exports, self.images)
        self.assertEqual(len(bundle['splits']['train'][0]['objects']), 2)
        self.assertEqual(len(bundle['splits']['val']), 1)
        self.assertEqual(bundle['splits']['val'][0]['objects'], [])
        self.assertEqual(bundle['classes'], ['outer_door_frame_with_trim'])
        self.assertEqual(bundle['splits']['train'][0]['objects'][0],
                         {'class_id': 0, 'bbox_xywh': [10, 20, 60, 120]})

    def test_rejects_unverified_even_if_manifest_claims_verified(self):
        (self.exports / 'manifest.json').write_text('{"status":"VERIFIED"}')
        edit(self.exports / 'train_corners.json', lambda rows: rows[0].update(verified=False))
        with self.assertRaisesRegex(ValueError, 'unverified'):
            load_bundle(self.exports, self.images)

    def test_rejects_physical_scene_leakage(self):
        edit(self.exports / 'val_corners.json', lambda rows: rows[0].update(group='train_physical_scene'))
        with self.assertRaisesRegex(ValueError, 'group leakage'):
            load_bundle(self.exports, self.images)

    def test_rejects_identical_photo_under_another_filename(self):
        (self.images / 'val.png').write_bytes((self.images / 'train.png').read_bytes())
        with self.assertRaisesRegex(ValueError, 'duplicate image'):
            load_bundle(self.exports, self.images)

    def test_rejects_mismatched_class_mapping(self):
        edit(self.exports / 'val_coco.json', lambda c: c['categories'][0].update(name='window'))
        with self.assertRaisesRegex(ValueError, 'categories differ'):
            load_bundle(self.exports, self.images)

    def test_rejects_boxes_outside_image_and_nonfinite_values(self):
        for box in ([95, 20, 60, 100], [10, 20, float('nan'), 100], [10, 20, 0, 100]):
            with self.subTest(box=box):
                edit(self.exports / 'train_coco.json', lambda c: c['annotations'][0].update(bbox=box))
                with self.assertRaisesRegex(ValueError, 'bbox'):
                    load_bundle(self.exports, self.images)

    def test_rejects_image_dimensions_different_from_labels(self):
        edit(self.exports / 'val_coco.json', lambda c: c['images'][0].update(width=101))
        with self.assertRaisesRegex(ValueError, 'dimensions'):
            load_bundle(self.exports, self.images)

    def test_rejects_path_outside_images_directory(self):
        edit(self.exports / 'train_coco.json', lambda c: c['images'][0].update(file_name='../outside.png'))
        with self.assertRaisesRegex(ValueError, 'unsafe'):
            load_bundle(self.exports, self.images)

    def test_rejects_unknown_annotation_image(self):
        edit(self.exports / 'train_coco.json', lambda c: c['annotations'][0].update(image_id=99))
        with self.assertRaisesRegex(ValueError, 'unknown image'):
            load_bundle(self.exports, self.images)

    def test_cli_stops_before_writing_weights_for_unverified_photos(self):
        edit(self.exports / 'train_corners.json', lambda rows: rows[0].update(verified=False))
        output = self.root / 'training-output'
        command = [sys.executable, str(Path(__file__).with_name('train_yolox.py')),
                   '--dataset', str(self.exports), '--images', str(self.images),
                   '--upstream', str(self.root / 'missing-source'),
                   '--checkpoint', str(self.root / 'missing-checkpoint'),
                   '--rights', str(self.root / 'missing-rights'), '--output', str(output)]
        result = subprocess.run(command, text=True, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('unverified annotation', result.stderr)
        self.assertFalse(output.exists())


class RightsGateTests(unittest.TestCase):
    def test_dataset_permission_is_bound_to_the_reviewed_bundle(self):
        permission = {'allowed_for_training': True, 'evidence': 'permission document',
                      'reviewer': 'data owner', 'reviewed_at': '2026-11-11'}
        rights = {'checkpoint': {**permission, 'sha256': 'a' * 64},
                  'dataset': {**permission, 'sha256': 'b' * 64}}
        check_training_rights(rights, 'a' * 64, 'b' * 64)
        with self.assertRaisesRegex(ValueError, 'dataset.*SHA256'):
            check_training_rights(rights, 'a' * 64, 'c' * 64)

    def test_pending_or_unmatched_checkpoint_permission_is_rejected(self):
        for rights in ({}, {'checkpoint': {'allowed_for_training': False}},
                       {'checkpoint': {'allowed_for_training': True, 'sha256': 'wrong'}}):
            with self.subTest(rights=rights), self.assertRaises(ValueError):
                check_training_rights(rights, 'a' * 64, 'b' * 64)

    def test_evidence_required_for_both_data_and_exact_checkpoint(self):
        permission = {'allowed_for_training': True, 'evidence': 'permission document',
                      'reviewer': 'data owner', 'reviewed_at': '2026-11-11'}
        rights = {'checkpoint': {**permission, 'sha256': 'a' * 64},
                  'dataset': {**permission, 'sha256': 'b' * 64}}
        check_training_rights(rights, 'a' * 64, 'b' * 64)
        bad = copy.deepcopy(rights); bad['dataset']['evidence'] = ''
        with self.assertRaisesRegex(ValueError, 'evidence'):
            check_training_rights(bad, 'a' * 64, 'b' * 64)

if __name__ == '__main__':
    unittest.main()
