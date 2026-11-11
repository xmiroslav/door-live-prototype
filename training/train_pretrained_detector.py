#!/usr/bin/env python3
"""Fine-tune torchvision Faster R-CNN MobileNetV3-320 COCO pretrained weights on door-frame boxes.
LEGACY research path, not the approved architecture. Use train_yolox.py for the current YOLOX-Nano path.
Research-only until labels, license, holdout metrics and browser runtime are verified.
Requires pip install torch torchvision pillow and local compatible licensed weights.
"""
import argparse,json
from pathlib import Path
import torch
from torch.utils.data import Dataset,DataLoader
from PIL import Image
from torchvision.models.detection import fasterrcnn_mobilenet_v3_large_320_fpn
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor
from torchvision.transforms.functional import pil_to_tensor
class DoorBoxes(Dataset):
 def __init__(self,images,annotations):
  self.images=images;c=json.loads(annotations.read_text())
  byimage={im['id']:im for im in c['images']}
  self.entries=[(byimage[a['image_id']]['file_name'],a['bbox']) for a in c['annotations']]
 def __len__(self):return len(self.entries)
 def __getitem__(self,i):
  name,box=self.entries[i];im=Image.open(self.images/name).convert('RGB');x,y,w,h=box
  return pil_to_tensor(im).float()/255,{'boxes':torch.tensor([[x,y,x+w,y+h]],dtype=torch.float32),'labels':torch.tensor([1],dtype=torch.int64),'image_id':torch.tensor(i)}
def main():
 p=argparse.ArgumentParser();p.add_argument('--images',type=Path,required=True);p.add_argument('--dataset',type=Path,required=True);p.add_argument('--pretrained-weights',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--epochs',type=int,default=12);p.add_argument('--allow-unverified',action='store_true');a=p.parse_args()
 manifest=json.loads((a.dataset/'manifest.json').read_text())
 if manifest['status']!='VERIFIED' and not a.allow_unverified:raise SystemExit('STOP: unverified labels. Use --allow-unverified for research only.')
 if not a.pretrained_weights.exists():raise SystemExit('STOP: pretrained weights missing; no random initialization fallback.')
 model=fasterrcnn_mobilenet_v3_large_320_fpn(weights=None,weights_backbone=None)
 model.load_state_dict(torch.load(a.pretrained_weights,map_location='cpu',weights_only=True),strict=True)
 model.roi_heads.box_predictor=FastRCNNPredictor(model.roi_heads.box_predictor.cls_score.in_features,2)
 train=DoorBoxes(a.images,a.dataset/'train_coco.json');val=DoorBoxes(a.images,a.dataset/'val_coco.json')
 if not len(train) or not len(val):raise SystemExit('Empty train/val split')
 loader=DataLoader(train,batch_size=2,shuffle=True,collate_fn=lambda x:tuple(zip(*x)))
 device='cuda' if torch.cuda.is_available() else 'cpu';model.to(device)
 opt=torch.optim.AdamW(model.parameters(),lr=1e-4,weight_decay=1e-4)
 a.output.mkdir(parents=True,exist_ok=True);history=[]
 for epoch in range(a.epochs):
  model.train();total=0
  for imgs,targets in loader:
   imgs=[im.to(device) for im in imgs];targets=[{k:v.to(device) for k,v in t.items()} for t in targets]
   opt.zero_grad();loss=sum(model(imgs,targets).values());loss.backward();opt.step();total+=loss.item()
  history.append({'epoch':epoch+1,'train_loss':total/len(loader)});print(history[-1],flush=True)
 torch.save({'state_dict':model.cpu().state_dict(),'classes':['background','outer_door_frame_with_trim'],'pretrained_source':str(a.pretrained_weights),'labels_verified':manifest['status']=='VERIFIED'},a.output/'door_frame_detector_research.pt')
 (a.output/'training_log.json').write_text(json.dumps({'history':history,'validation_images':len(val),'warning':'No keypoint head, no independent test, not production ready.'},indent=2))
if __name__=='__main__':main()
