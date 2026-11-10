#!/usr/bin/env python3
"""Build a leakage-safe Door Live dataset manifest. Never silently trust provisional labels.
Usage: python training/build_dataset.py annotations.json --output training/dataset_manifest.json
Optional: --allow-provisional (for experiments only).
"""
import argparse, json, pathlib, hashlib, sys
def build(data, allow_provisional=False):
    groups={}; issues=[]; accepted=[]
    for item in data.get("images",[]):
        name=item.get("file"); group=item.get("group")
        points=item.get("keypoints_xy",[])
        if not name or not group: issues.append(f"{name}: missing file or physical doorway group"); continue
        if len(points)!=4 or any(len(p)!=2 for p in points):
            issues.append(f"{name}: requires four ordered outer-frame corners"); continue
        if item.get("annotation_plane")!="outer_existing_frame_and_trim":
            issues.append(f"{name}: wrong annotation target"); continue
        if item.get("verified") is not True and not allow_provisional:
            issues.append(f"{name}: not human verified"); continue
        groups.setdefault(group,[]).append(name)
        accepted.append({"file":name,"group":group,"corners":points,"verified":item.get("verified") is True})
    # Deterministic split by physical doorway, not individual images.
    split={}
    for group in sorted(groups):
        bucket=int(hashlib.sha256(group.encode()).hexdigest()[:8],16)%5
        split[group]="validation" if bucket==0 else "train"
    if len(groups)>1 and "validation" not in split.values():
        split[sorted(groups)[-1]]="validation"
    if len(groups)>1 and "train" not in split.values():
        split[sorted(groups)[0]]="train"
    for item in accepted:item["split"]=split[item["group"]]
    return {"target":"single_door_outer_frame_and_trim","status":"experimental" if allow_provisional else "verified_only",
            "images":accepted,"groups":split,"rejected":issues,
            "ready_for_training":bool(accepted) and not issues and len(set(split.values()))==2}
def main():
    p=argparse.ArgumentParser();p.add_argument("annotations");p.add_argument("--output");p.add_argument("--allow-provisional",action="store_true")
    args=p.parse_args()
    manifest=build(json.loads(pathlib.Path(args.annotations).read_text()),args.allow_provisional)
    result=json.dumps(manifest,ensure_ascii=False,indent=2)
    if args.output:pathlib.Path(args.output).write_text(result+"\n",encoding="utf-8")
    else:print(result)
    print(f"Accepted: {len(manifest['images'])}, rejected: {len(manifest['rejected'])}, training-ready: {manifest['ready_for_training']}",file=sys.stderr)
    return 0 if manifest["ready_for_training"] else 2
if __name__=="__main__":sys.exit(main())
