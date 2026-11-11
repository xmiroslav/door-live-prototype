#!/usr/bin/env python3
"""Apply user-redrawn research quads to a private exported dataset ZIP.

Outputs remain provisional. This script never turns these corrections into
verified ground truth or changes the original ZIP.
"""
import argparse
import copy
import json
import math
import zipfile
from pathlib import Path


def apply_corrections(dataset, corrections):
    result = copy.deepcopy(dataset)
    indexed = {}
    for split, items in result.items():
        for item in items:
            if item['file'] in indexed:
                raise ValueError('duplicate image: ' + item['file'])
            indexed[item['file']] = (split, item)
    aliases = {}
    seen = set()
    for correction in corrections['images']:
        name = correction['file']
        if name in seen or name not in indexed:
            raise ValueError('duplicate or missing corrected image: ' + name)
        seen.add(name)
        _, item = indexed[name]
        if [item['width'], item['height']] != corrections['image_size']:
            raise ValueError('coordinate dimensions differ: ' + name)
        if correction.get('annotation_plane') != 'outer_existing_frame_and_trim':
            raise ValueError('wrong annotation plane: ' + name)
        points = correction['keypoints_xy']
        if len(points) != 4 or any(len(p) != 2 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in p) for p in points):
            raise ValueError('invalid corners: ' + name)
        if any(not (0 <= x < item['width'] and 0 <= y < item['height']) for x, y in points):
            raise ValueError('corner outside image: ' + name)
        old, new = item['group'], correction['group']
        if old in aliases and aliases[old] != new:
            raise ValueError('conflicting group aliases: ' + old)
        aliases[old] = new
        item['quad_xy_tl_tr_br_bl'] = copy.deepcopy(points)
        item['verified'] = False
        item['annotation_source'] = 'user_red_montage_transcription_pending_full_resolution_review'
    groups = {}
    for split, items in result.items():
        for item in items:
            item['group'] = aliases.get(item['group'], item['group'])
            group = item['group']
            if group in groups and groups[group] != split:
                raise ValueError('physical doorway group crosses splits: ' + group)
            groups[group] = split
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dataset', type=Path)
    parser.add_argument('corrections', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.dataset.resolve() == args.output.resolve():
        raise ValueError('output must differ from original')
    with zipfile.ZipFile(args.dataset) as source:
        splits = {s: json.loads(source.read(f'exports/{s}_corners.json')) for s in ('train', 'val', 'test')}
        corrections = json.loads(args.corrections.read_text())
        updated = apply_corrections(splits, corrections)
        replacements = {}
        for split, rows in updated.items():
            replacements[f'exports/{split}_corners.json'] = json.dumps(rows, indent=2).encode()
            coco = json.loads(source.read(f'exports/{split}_coco.json'))
            by_name = {row['file']: row for row in rows}
            name_by_id = {item['id']: item['file_name'] for item in coco['images']}
            for ann in coco['annotations']:
                row = by_name[name_by_id[ann['image_id']]]
                q = row['quad_xy_tl_tr_br_bl']
                xs, ys = zip(*q)
                ann['bbox'] = [min(xs), min(ys), max(xs)-min(xs), max(ys)-min(ys)]
                ann['area'] = abs(sum(q[i][0]*q[(i+1)%4][1]-q[(i+1)%4][0]*q[i][1] for i in range(4))/2)
                ann['segmentation'] = [[v for pt in q for v in pt]]
            replacements[f'exports/{split}_coco.json'] = json.dumps(coco, indent=2).encode()
        manifest = json.loads(source.read('exports/manifest.json'))
        manifest['status'] = 'RESEARCH_ONLY_UNVERIFIED'
        manifest['correction_source'] = 'user red montage, provisional transcription; not verified'
        manifest['groups'] = len({row['group'] for rows in updated.values() for row in rows})
        for split, rows in updated.items():
            manifest['splits'][split]['groups'] = sorted({row['group'] for row in rows})
            manifest['splits'][split]['photos'] = len(rows)
        replacements['exports/manifest.json'] = json.dumps(manifest, indent=2).encode()
        with zipfile.ZipFile(args.output, 'w', zipfile.ZIP_DEFLATED) as output:
            for info in source.infolist():
                output.writestr(info, replacements.get(info.filename, source.read(info.filename)))
    print(f"Updated {len(corrections['images'])} corrections; dataset remains unverified: {args.output}")


if __name__ == '__main__':
    main()
