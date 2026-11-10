import unittest
import numpy as np
from geometry import warp_image_and_corners,random_perspective,group_split
class TestPerspective(unittest.TestCase):
    def test_identity(self):
        image=np.zeros((100,80,3),np.uint8)
        corners=np.float32([[10,10],[70,10],[70,90],[10,90]])
        dst=np.float32([[0,0],[79,0],[79,99],[0,99]])
        _,out,_=warp_image_and_corners(image,corners,dst)
        self.assertTrue(np.allclose(corners,out,atol=.01))
    def test_random(self):
        image=np.zeros((100,80,3),np.uint8)
        corners=np.float32([[10,10],[70,10],[70,90],[10,90]])
        warped,out=random_perspective(image,corners,np.random.default_rng(12))
        self.assertEqual(warped.shape,image.shape)
        self.assertEqual(out.shape,(4,2))
        self.assertFalse(np.allclose(corners,out))
    def test_group_split(self):
        a,b=group_split([{'group':'same'},{'group':'same'},{'group':'other'}],{'other'})
        self.assertEqual((len(a),len(b)),(2,1))
if __name__=='__main__':unittest.main()
