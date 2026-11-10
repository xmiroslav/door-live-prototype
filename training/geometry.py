"""Perspective-aware training utilities for single-door outer-frame corners."""
import numpy as np
import cv2

def warp_image_and_corners(image, corners, destination, out_size=None):
    """Warp image and TL,TR,BR,BL labels with the SAME projective transform."""
    h,w=image.shape[:2]
    src=np.float32([[0,0],[w-1,0],[w-1,h-1],[0,h-1]])
    dst=np.asarray(destination,dtype=np.float32)
    if dst.shape!=(4,2): raise ValueError('destination must contain four [x,y] points')
    matrix=cv2.getPerspectiveTransform(src,dst)
    warped=cv2.warpPerspective(image,matrix,out_size or (w,h),
                              flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)
    target=cv2.perspectiveTransform(np.asarray(corners,dtype=np.float32).reshape(1,4,2),matrix).reshape(4,2)
    return warped,target,matrix

def random_perspective(image,corners,rng,magnitude=0.10):
    h,w=image.shape[:2]
    base=np.float32([[0,0],[w-1,0],[w-1,h-1],[0,h-1]])
    displacement=rng.uniform(-magnitude,magnitude,size=(4,2)).astype(np.float32)
    displacement*=np.float32([w,h])
    return warp_image_and_corners(image,corners,base+displacement)[:2]

def normalized_corner_error(predicted,target,frame_height):
    return float(np.linalg.norm(np.asarray(predicted)-np.asarray(target),axis=1).mean()/frame_height)

def group_split(records,validation_groups):
    train=[r for r in records if r['group'] not in validation_groups]
    valid=[r for r in records if r['group'] in validation_groups]
    if not train or not valid: raise ValueError('Need training and validation groups')
    assert not ({r['group'] for r in train}&{r['group'] for r in valid})
    return train,valid
