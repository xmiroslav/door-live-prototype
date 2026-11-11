import copy
import unittest

from apply_red_corrections import apply_corrections


class CorrectionTests(unittest.TestCase):
    def setUp(self):
        self.dataset = {'train': [{'file': 'a.jpg', 'group': 'old', 'width': 100, 'height': 200,
            'quad_xy_tl_tr_br_bl': [[10, 10], [80, 10], [80, 180], [10, 180]], 'verified': True}]}
        self.corrections = {'image_size': [100, 200], 'images': [{'file': 'a.jpg', 'group': 'new',
            'annotation_plane': 'outer_existing_frame_and_trim', 'verified': False,
            'keypoints_xy': [[12, 14], [75, 16], [70, 160], [15, 170]]}]}

    def test_red_points_override_old_and_reset_verification(self):
        result = apply_corrections(self.dataset, self.corrections)
        item = result['train'][0]
        self.assertEqual(item['quad_xy_tl_tr_br_bl'], self.corrections['images'][0]['keypoints_xy'])
        self.assertEqual(item['group'], 'new')
        self.assertFalse(item['verified'])
        self.assertEqual(self.dataset['train'][0]['group'], 'old')

    def test_missing_image_and_dimension_mismatch_rejected(self):
        bad = copy.deepcopy(self.corrections)
        bad['images'][0]['file'] = 'missing.jpg'
        with self.assertRaises(ValueError): apply_corrections(self.dataset, bad)
        bad = copy.deepcopy(self.corrections)
        bad['image_size'] = [90, 200]
        with self.assertRaises(ValueError): apply_corrections(self.dataset, bad)

    def test_group_leakage_is_rejected(self):
        data = copy.deepcopy(self.dataset)
        data['test'] = [dict(data['train'][0], file='b.jpg', group='new')]
        with self.assertRaises(ValueError): apply_corrections(data, self.corrections)

if __name__ == '__main__': unittest.main()
