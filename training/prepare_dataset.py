#!/usr/bin/env python3
"""Prepare reproducible COCO boxes and 4-corner labels. No ML training."""
import argparse,json,random
from pathlib import Path
from PIL import Image
def area(p):
 return sum(p[i][0]*p[(i+1)%4][1]-p[(i+1)%4][0]*p[i][1] for i in range(4))/2
def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def intersects(a,b,c,d):return cross(a,b,c)*cross(a,b,d)<0 and cross(c,d,a)*cross(c,d,b)<0
def main():
 p=argparse.ArgumentParser()
 p.add_argument('--labels',required=True,type=Path);p.add_argument('--images',required=True,type=Path);p.add_argument('--output',required=True,type=Path)
 p.add_argument('--allow-unverified',action='store_true',help='research-only export')
 a=p.parse_args();entries=json.loads(a.labels.read_text(encoding='utf-8'))['images']
 if any(not e.get('verified',False) for e in entries) and not a.allow_unverified:raise SystemExit('Unverified annotations: add --allow-unverified for research-only export')
 for e in entries:
  f=a.images/e['file']
  if not f.exists():raise SystemExit('Missing image: '+str(f))
  with Image.open(f) as im:w,h=im.size
  oldw,oldh=e['width'],e['height'];q=e['keypoints_xy']
  if len(q)!=4 or any(len(pt)!=2 for pt in q):raise SystemExit('Expected four corners: '+e['file'])
  if (w,h)!=(oldw,oldh):
   if e.get('source_coordinate_size')!=[oldw,oldh]:raise SystemExit('Unexplained dimension mismatch: '+e['file'])
   q=[[round(x*w/oldw,3),round(y*h/oldh,3)] for x,y in q]
  if any(not(0<=x<=w and 0<=y<=h) for x,y in q) or abs(area(q))<.025*w*h:raise SystemExit('Invalid quadrilateral: '+e['file'])
  if intersects(q[0],q[1],q[2],q[3]) or intersects(q[1],q[2],q[3],q[0]):raise SystemExit('Self-intersection: '+e['file'])
  e.update(width=w,height=h,keypoints_xy=q)
 groups=sorted(set(e['group'] for e in entries));random.Random(20261110).shuffle(groups)
 n=max(2,round(len(groups)*.2));sets={'test':set(groups[:n]),'val':set(groups[n:2*n]),'train':set(groups[2*n:])}
 a.output.mkdir(parents=True,exist_ok=True);summary={'status':'RESEARCH_ONLY_UNVERIFIED' if any(not e.get('verified',False) for e in entries) else 'VERIFIED','count':len(entries),'splits':{}}
 for split,gset in sets.items():
  items=[e for e in entries if e['group'] in gset]
  coco={'images':[],'annotations':[],'categories':[{'id':1,'name':'outer_door_frame_with_trim'}]}
  corners=[]
  for i,e in enumerate(items,1):
   q=e['keypoints_xy'];xs=[p[0] for p in q];ys=[p[1] for p in q];x0=min(xs);y0=min(ys)
   coco['images'].append({'id':i,'file_name':e['file'],'width':e['width'],'height':e['height']})
   coco['annotations'].append({'id':i,'image_id':i,'category_id':1,'bbox':[x0,y0,max(xs)-x0,max(ys)-y0],'area':abs(area(q)),'iscrowd':0,'segmentation':[[v for pt in q for v in pt]]})
   corners.append({'file':e['file'],'group':e['group'],'width':e['width'],'height':e['height'],'quad_xy_tl_tr_br_bl':q,'verified':e.get('verified',False)})
  (a.output/(split+'_coco.json')).write_text(json.dumps(coco,indent=2,ensure_ascii=False),encoding='utf-8')
  (a.output/(split+'_corners.json')).write_text(json.dumps(corners,indent=2,ensure_ascii=False),encoding='utf-8')
  summary['splits'][split]={'photos':len(items),'groups':sorted(gset)}
 (a.output/'manifest.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding='utf-8')
 print(json.dumps(summary,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
