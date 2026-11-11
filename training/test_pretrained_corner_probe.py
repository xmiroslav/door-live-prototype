import unittest
import numpy as np
from pretrained_corner_probe import flip_corners, ridge_head, diagonal_error


class CornerProbeTests(unittest.TestCase):
    def test_flip_reorders_corners(self):
        points = np.array([[.1,.2],[.8,.25],[.9,.8],[.2,.9]], dtype=np.float32)
        np.testing.assert_allclose(flip_corners(points), [[.2,.25],[.9,.2],[.8,.9],[.1,.8]], atol=1e-6)
        np.testing.assert_allclose(flip_corners(flip_corners(points)), points, atol=1e-6)

    def test_ridge_head_predicts_training_relationship(self):
        x = np.array([[0., 0.], [1., 0.], [0., 1.], [1., 1.]])
        y = np.column_stack((2*x[:,0]+x[:,1]+3, x[:,0]-x[:,1]))
        w, b = ridge_head(x, y, 1e-8)
        np.testing.assert_allclose(x @ w + b, y, atol=1e-6)

    def test_error_uses_image_diagonal_in_pixels(self):
        truth = np.zeros((4,2)); predicted = np.tile([.1,0.], (4,1))
        self.assertAlmostEqual(diagonal_error(predicted, truth, 300, 400), .06)

if __name__ == '__main__': unittest.main()
