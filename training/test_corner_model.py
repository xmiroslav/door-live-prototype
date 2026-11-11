import unittest
import torch
from corner_model import DoorCornerModel, corner_training_loss

class CornerModelTests(unittest.TestCase):
    def test_four_heatmaps_and_visibility_have_real_gradients(self):
        torch.manual_seed(7);torch.set_num_threads(2)
        model=DoorCornerModel()
        heatmaps,visibility=model(torch.rand(2,3,256,256))
        self.assertEqual(tuple(heatmaps.shape),(2,4,64,64))
        self.assertEqual(tuple(visibility.shape),(2,4))
        points=torch.tensor([[[.2,.1],[.8,.2],[.7,.9],[.3,.8]]]*2)
        visible=torch.ones(2,4,dtype=torch.bool)
        loss=corner_training_loss(heatmaps,visibility,points,visible)
        self.assertTrue(torch.isfinite(loss).item())
        loss.backward()
        self.assertGreater(model.heatmaps.weight.grad.abs().sum().item(),0)
        self.assertGreater(model.visibility.weight.grad.abs().sum().item(),0)

    def test_hidden_or_cropped_corners_do_not_supervise_fabricated_positions(self):
        heatmaps=torch.zeros(1,4,8,8,requires_grad=True)
        visibility=torch.zeros(1,4,requires_grad=True)
        points=torch.tensor([[[.2,.2],[.8,.2],[float('nan'),float('nan')],[.2,.8]]])
        visible=torch.tensor([[True,True,False,True]])
        loss=corner_training_loss(heatmaps,visibility,points,visible)
        self.assertTrue(torch.isfinite(loss).item())
        loss.backward()
        self.assertEqual(heatmaps.grad[0,2].abs().sum().item(),0)
        self.assertNotEqual(visibility.grad[0,2].item(),0)

    def test_no_visible_corners_still_learn_visibility(self):
        heatmaps=torch.zeros(1,4,8,8,requires_grad=True)
        visibility=torch.zeros(1,4,requires_grad=True)
        points=torch.full((1,4,2),float('nan'))
        loss=corner_training_loss(heatmaps,visibility,points,torch.zeros(1,4,dtype=torch.bool))
        loss.backward()
        self.assertEqual(heatmaps.grad.abs().sum().item(),0)
        self.assertGreater(visibility.grad.abs().sum().item(),0)

    def test_visible_out_of_crop_target_is_rejected(self):
        points=torch.tensor([[[.2,.2],[1.2,.2],[.8,.8],[.2,.8]]])
        with self.assertRaises(ValueError):
            corner_training_loss(torch.zeros(1,4,8,8),torch.zeros(1,4),points,
                                 torch.ones(1,4,dtype=torch.bool))

    def test_all_hidden_extreme_finite_logits_do_not_overflow_zero_loss(self):
        heatmaps=torch.full((1,4,8,8),1e38,requires_grad=True)
        loss=corner_training_loss(heatmaps,torch.zeros(1,4),
                                 torch.full((1,4,2),float('nan')),torch.zeros(1,4,dtype=torch.bool))
        self.assertTrue(torch.isfinite(loss).item())
        loss.backward()
        self.assertEqual(heatmaps.grad.abs().sum().item(),0)

    def test_sigma_too_small_for_numeric_precision_is_rejected(self):
        with self.assertRaises(ValueError):
            corner_training_loss(torch.zeros(1,4,8,8),torch.zeros(1,4),
                                 torch.full((1,4,2),.5),torch.ones(1,4,dtype=torch.bool),
                                 sigma_cells=1e-300)

if __name__=='__main__':unittest.main()
