#!/usr/bin/env python3
"""Validate Door Live outer-frame four-corner annotations before training.
Usage: python3 training/validate_annotations.py path/to/annotations.json
Supports batch01 user corrections and schema v2 image/instance format.
No external Python dependencies.
"""
import json, math, pathlib, sys

def polygon_area(p):
    return sum(p[i][0]*p[(i+1)%4][1]-p[(i+1)%4][0]*p[i][1] for i in range(4))/2

def validate(path):
    doc=json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    issues=[]; total=0
    for i, image in enumerate(doc.get("images", [])):
        w,h=image.get("width"),image.get("height")
        name=image.get("file", f"image_{i}")
        instances=image.get("instances")
        if instances is None: instances=[image] if "keypoints_xy" in image else []
        if not instances: issues.append(f"{name}: no labeled doorways")
        for j,inst in enumerate(instances):
            total+=1
            p=inst.get("keypoints_xy")
            prefix=f"{name} instance {j+1}"
            if not isinstance(p,list) or len(p)!=4 or any(not isinstance(q,list) or len(q)!=2 for q in p):
                issues.append(f"{prefix}: requires four [x,y] corners"); continue
            if not all(isinstance(v,(int,float)) and math.isfinite(v) for q in p for v in q):
                issues.append(f"{prefix}: invalid coordinate"); continue
            if not isinstance(w,(int,float)) or not isinstance(h,(int,float)):
                issues.append(f"{prefix}: missing image size"); continue
            if any(not (0<=x<w and 0<=y<h) for x,y in p):
                issues.append(f"{prefix}: corner outside image")
            area=polygon_area(p)
            if area<=0: issues.append(f"{prefix}: wrong order, self-crossing or zero area")
            if area < w*h*0.005: issues.append(f"{prefix}: unusually small doorway area")
            if inst.get("verified") is not True:
                issues.append(f"{prefix}: NOT human-verified; do not train as ground truth")
            if inst.get("annotation_plane",doc.get("installation_target")) not in (
                "outer_existing_frame_and_trim","outer_visible_existing_frame_including_trim"):
                issues.append(f"{prefix}: installation plane is not outer frame + trim")
    print(f"Images: {len(doc.get('images',[]))}; instances: {total}; issues: {len(issues)}")
    for item in issues: print(" -",item)
    return 1 if issues else 0

if __name__=="__main__":
    if len(sys.argv)!=2: sys.exit("Usage: validate_annotations.py annotations.json")
    sys.exit(validate(sys.argv[1]))
