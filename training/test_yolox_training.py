import os
from pathlib import Path
import unittest
import numpy as np
from train_yolox import match_predictions, prepare_sample, build_pretrained_model


class DetectionMetricTests(unittest.TestCase):
    def test_duplicate_predictions_do_not_inflate_recall(self):
        truth = [{'class_id': 0, 'bbox_xywh': [10, 20, 20, 40]}]
        predictions = [{'class_id': 0, 'bbox_xyxy': [10, 20, 30, 60], 'score': .9},
                       {'class_id': 0, 'bbox_xyxy': [10, 20, 30, 60], 'score': .8}]
        self.assertEqual(match_predictions(predictions, truth), {'tp': 1, 'fp': 1, 'fn': 0})

    def test_wrong_class_and_negative_images_count_as_false_positives(self):
        prediction = {'class_id': 1, 'bbox_xyxy': [10, 20, 30, 60], 'score': .9}
        truth = [{'class_id': 0, 'bbox_xywh': [10, 20, 20, 40]}]
        self.assertEqual(match_predictions([prediction], truth), {'tp': 0, 'fp': 1, 'fn': 1})
        self.assertEqual(match_predictions([prediction], []), {'tp': 0, 'fp': 1, 'fn': 0})
        self.assertEqual(match_predictions([], truth), {'tp': 0, 'fp': 0, 'fn': 1})

    def test_below_iou_threshold_does_not_match(self):
        prediction = {'class_id': 0, 'bbox_xyxy': [10, 20, 19, 60], 'score': .9}
        truth = [{'class_id': 0, 'bbox_xywh': [10, 20, 20, 40]}]
        self.assertEqual(match_predictions([prediction], truth), {'tp': 0, 'fp': 1, 'fn': 1})

    def test_letterbox_keeps_bgr_pixel_scale_and_all_instances(self):
        bgr = np.zeros((100, 50, 3), np.uint8)
        bgr[:, :] = [20, 50, 90]
        sample = {'objects': [{'class_id': 1, 'bbox_xywh': [10, 20, 20, 40]},
                              {'class_id': 0, 'bbox_xywh': [30, 10, 10, 80]}]}
        image, labels, scale = prepare_sample(bgr, sample, size=200)
        self.assertEqual(image.shape, (3, 200, 200))
        self.assertEqual(scale, 2)
        np.testing.assert_array_equal(image[:, 0, 0], [20, 50, 90])
        np.testing.assert_array_equal(image[:, 10, 150], [114, 114, 114])
        np.testing.assert_array_equal(labels, [[1, 40, 80, 40, 80], [0, 70, 100, 20, 160]])

    def test_negative_has_zero_labels_and_excess_instances_are_not_truncated(self):
        _, labels, _ = prepare_sample(np.zeros((100, 50, 3), np.uint8), {'objects': []})
        self.assertEqual(labels.shape, (0, 5))
        objects = [{'class_id': 0, 'bbox_xywh': [1, 1, 10, 20]}] * 60
        _, labels, _ = prepare_sample(np.zeros((100, 50, 3), np.uint8), {'objects': objects})
        self.assertEqual(labels.shape, (60, 5))


@unittest.skipUnless(os.environ.get('UNIDOORS_YOLOX_SOURCE') and os.environ.get('UNIDOORS_YOLOX_CHECKPOINT'),
                     'Set UNIDOORS_YOLOX_SOURCE and UNIDOORS_YOLOX_CHECKPOINT for real upstream test')
class PretrainedTrainingIntegrationTests(unittest.TestCase):
    def test_finetune_transfers_backbone_and_optimizer_updates_real_detector(self):
        import torch
        torch.manual_seed(42); torch.set_num_threads(2)
        source = Path(os.environ['UNIDOORS_YOLOX_SOURCE'])
        checkpoint = Path(os.environ['UNIDOORS_YOLOX_CHECKPOINT'])
        model, transfer = build_pretrained_model(source, checkpoint, num_classes=2)
        original = torch.load(checkpoint, map_location='cpu', weights_only=True)['model']
        key = 'backbone.backbone.stem.conv.conv.weight'
        self.assertTrue(torch.equal(model.state_dict()[key], original[key]))
        self.assertEqual(len(transfer['reinitialized_classification_tensors']), 6)
        self.assertEqual(model.head.num_classes, 2)
        # Synthetic plumbing check only: no user photograph, no accuracy claim.
        image = torch.rand((1, 3, 416, 416)) * 255
        labels = torch.tensor([[[0., 200., 200., 80., 180.], [1., 80., 200., 40., 80.]]])
        model.train()
        before = [head.weight.detach().clone() for head in model.head.cls_preds]
        optimizer = torch.optim.SGD(model.parameters(), lr=1e-3)
        loss = model(image, labels)['total_loss']
        self.assertTrue(torch.isfinite(loss).item())
        optimizer.zero_grad(); loss.backward(); optimizer.step()
        self.assertTrue(any(not torch.equal(old, head.weight.detach())
                            for old, head in zip(before, model.head.cls_preds)))
        self.assertTrue(all(torch.isfinite(p).all().item() for p in model.parameters()))

if __name__ == '__main__':
    unittest.main()
