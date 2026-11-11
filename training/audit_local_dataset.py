#!/usr/bin/env python3
"""Audit private Door Live dataset ZIP locally; no image upload."""
import argparse, hashlib, io, json, math, zipfile
from collections import defaultdict
from pathlib import PurePosixPath
from PIL import Image, ImageOps
def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def convex_quad(p):
 if len(p)!=4:return False
 s=[cross(p[i],p[(i+1)%4],p[(i+2)%4]) for i in range(4)]
 return all(v>1 for v in s) or all(v< -1 for v in s)
def dhash(im):
 im=ImageOps.exif_transpose(im).convert('L').resize((9,8),Image.Resampling.LANCZOS)
 a=list(im.getdata());h=0
 for y in range(8):
  for x in range(8):h=(h<<1)|int(a[y*9+x]>a[y*9+x+1])
 return h
def run(zip_path):
 errors=[];warnings=[];rows=[];groups=defaultdict(set);hashes=defaultdict(list);fingerprints=[]
 with zipfile.ZipFile(zip_path) as z:
  for split in ('train','val','test'):
   source=f'exports/{split}_corners.json'
   if source not in z.namelist():errors.append('missing '+source);continue
   for e in json.loads(z.read(source)):
    name=e.get('file','')
    if not name or PurePosixPath(name).name!=name:errors.append('unsafe filename '+name);continue
    path='images/'+name
    if path not in z.namelist():errors.append('missing photo '+path);continue
    raw=z.read(path)
    with Image.open(io.BytesIO(raw)) as im:
     im.load();w,h=im.size;fingerprints.append((split,name,dhash(im)))
    hashes[hashlib.sha256(raw).hexdigest()].append((split,name))
    if (w,h)!=(e.get('width'),e.get('height')):errors.append(name+': dimension mismatch')
    groups[str(e.get('group'))].add(split)
    p=e.get('quad_xy_tl_tr_br_bl',[])
    if not isinstance(p,list) or len(p)!=4 or any(not isinstance(q,list) or len(q)!=2 or not all(isinstance(c,(int,float)) and math.isfinite(c) for c in q) for q in p):errors.append(name+': invalid quad shape');continue
    if not all(0<=x<=w and 0<=y<=h for x,y in p):errors.append(name+': point outside image')
    if not convex_quad(p):errors.append(name+': invalid quad')
    if e.get('verified') is not True:warnings.append(name+': human verification pending')
    rows.append({'split':split,'file':name,'group':e.get('group'),'verified':e.get('verified') is True})
 for g,splits in groups.items():
  if len(splits)>1:errors.append('group leakage: '+g)
 for sha,files in hashes.items():
  if len(files)>1 and len({s for s,n in files})>1:errors.append('exact duplicate across splits: '+str(files))
 near=[]
 for i,(s,n,h) in enumerate(fingerprints):
  for t,m,j in fingerprints[i+1:]:
   distance=(h^j).bit_count()
   if s!=t and distance<=8:near.append({'a':s+'/'+n,'b':t+'/'+m,'dhash_distance':distance})
 if near:warnings.append(str(len(near))+' visually similar cross-split pairs require manual review')
 return {'counts':{s:sum(r['split']==s for r in rows) for s in ('train','val','test')},'total':len(rows),'verified':sum(r['verified'] for r in rows),'errors':errors,'warnings':warnings,'near_duplicates_cross_split':near}
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('zip');a.add_argument('--json');args=a.parse_args();r=run(args.zip)
 print(f"Images: {r['total']}; train/val/test: {r['counts']}; verified: {r['verified']}; errors: {len(r['errors'])}; warnings: {len(r['warnings'])}; near duplicate pairs: {len(r['near_duplicates_cross_split'])}")
 for v in r['errors']:print('ERROR:',v)
 for v in r['near_duplicates_cross_split']:print('REVIEW:',v)
 if args.json:
  with open(args.json,'w') as f:json.dump(r,f,indent=2)
 raise SystemExit(1 if r['errors'] else 0)
