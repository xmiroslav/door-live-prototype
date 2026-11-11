"""Strict, image-level COCO inputs for the local YOLOX training path."""
import hashlib
import json
import math
from pathlib import Path

from PIL import Image


def check_training_rights(rights, checkpoint_sha256, dataset_sha256):
    """Require recorded permission; this validates records, not legal conclusions."""
    for component in ('checkpoint', 'dataset'):
        record = rights.get(component, {})
        if record.get('allowed_for_training') is not True:
            raise ValueError(f'{component}: training permission pending')
        for field in ('evidence', 'reviewer', 'reviewed_at'):
            if not isinstance(record.get(field), str) or not record[field].strip():
                raise ValueError(f'{component}: missing {field}')
    if rights['checkpoint'].get('sha256') != checkpoint_sha256:
        raise ValueError('checkpoint: permission does not match exact SHA256')
    if rights['dataset'].get('sha256') != dataset_sha256:
        raise ValueError('dataset: permission does not match exact SHA256')


def file_sha256(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def load_bundle(dataset_dir, images_dir):
    """Read explicit train/val/test splits, never dropping negatives or instances.

    *_corners.json serves as the existing per-photo verification/group sidecar.
    Detector-only negative images may have no corner coordinates. These records
    do not certify corner accuracy, dataset rights, or physically distinct groups.
    """
    dataset_dir, images_dir = Path(dataset_dir), Path(images_dir).resolve()
    bundle = {'splits': {}, 'classes': [], 'source_hashes': {}}
    expected_categories = None
    seen_groups, seen_hashes, seen_names = {}, {}, set()
    for split in ('train', 'val', 'test'):
        coco_path = dataset_dir / f'{split}_coco.json'
        review_path = dataset_dir / f'{split}_corners.json'
        coco = json.loads(coco_path.read_text())
        reviews = json.loads(review_path.read_text())
        for path in (coco_path, review_path):
            bundle['source_hashes'][path.name] = file_sha256(path)
        categories = sorted((c['id'], c['name']) for c in coco['categories'])
        if not categories or len({i for i, _ in categories}) != len(categories):
            raise ValueError(f'{split}: invalid categories')
        if expected_categories is None:
            expected_categories = categories
            bundle['classes'] = [name for _, name in categories]
        elif categories != expected_categories:
            raise ValueError(f'{split}: categories differ across splits')
        class_map = {category_id: i for i, (category_id, _) in enumerate(categories)}
        review_map = {r['file']: r for r in reviews}
        if len(review_map) != len(reviews):
            raise ValueError(f'{split}: duplicate review records')
        by_id, samples = {}, []
        for image in coco['images']:
            name = image['file_name']
            if not isinstance(name, str) or not name or Path(name).name != name or '\\' in name:
                raise ValueError(f'{split}: unsafe image filename')
            path = (images_dir / name).resolve()
            if not path.is_relative_to(images_dir):
                raise ValueError(f'{split}: unsafe image path')
            review = review_map.get(name, {})
            if review.get('verified') is not True:
                raise ValueError(f'{split}/{name}: unverified annotation')
            group = review.get('group')
            if not isinstance(group, str) or not group.strip():
                raise ValueError(f'{split}/{name}: missing physical scene group')
            if group in seen_groups and seen_groups[group] != split:
                raise ValueError(f'{name}: group leakage: {group}')
            seen_groups[group] = split
            if name in seen_names:
                raise ValueError(f'{name}: duplicate image across splits')
            seen_names.add(name)
            digest = file_sha256(path)
            if digest in seen_hashes and seen_hashes[digest] != split:
                raise ValueError(f'{name}: duplicate image bytes across splits')
            seen_hashes[digest] = split
            with Image.open(path) as bitmap:
                bitmap.load()
                size = bitmap.size
                if bitmap.getexif().get(274, 1) != 1:
                    raise ValueError(f'{name}: normalize EXIF orientation and labels first')
            if size != (image['width'], image['height']):
                raise ValueError(f'{name}: image dimensions differ from COCO labels')
            if size != (review.get('width'), review.get('height')):
                raise ValueError(f'{name}: review dimensions differ from image')
            if image['id'] in by_id:
                raise ValueError(f'{split}: duplicate image id')
            sample = {'file': name, 'path': str(path), 'width': size[0], 'height': size[1],
                      'group': group, 'sha256': digest, 'objects': []}
            by_id[image['id']] = sample
            samples.append(sample)
        seen_annotation_ids = set()
        for annotation in coco['annotations']:
            if annotation['id'] in seen_annotation_ids:
                raise ValueError(f'{split}: duplicate annotation id')
            seen_annotation_ids.add(annotation['id'])
            if annotation['image_id'] not in by_id:
                raise ValueError(f'{split}: annotation references unknown image')
            if annotation['category_id'] not in class_map:
                raise ValueError(f'{split}: unknown category')
            if annotation.get('iscrowd', 0):
                raise ValueError(f'{split}: crowd annotations need an explicit ignore policy')
            sample = by_id[annotation['image_id']]
            box = annotation['bbox']
            if (not isinstance(box, list) or len(box) != 4
                    or any(isinstance(v, bool) or not isinstance(v, (int, float))
                           or not math.isfinite(v) for v in box)):
                raise ValueError(f'{sample["file"]}: invalid bbox')
            x, y, width, height = box
            if (x < 0 or y < 0 or width <= 0 or height <= 0
                    or x + width > sample['width'] or y + height > sample['height']):
                raise ValueError(f'{sample["file"]}: bbox outside image or empty')
            sample['objects'].append({'class_id': class_map[annotation['category_id']],
                                      'bbox_xywh': box})
        if not samples:
            raise ValueError(f'{split}: empty split')
        if set(review_map) != {s['file'] for s in samples}:
            raise ValueError(f'{split}: review and COCO image sets differ')
        bundle['splits'][split] = samples
    if not any(s['objects'] for s in bundle['splits']['train']):
        raise ValueError('train: no positive objects')
    fingerprint = {'classes': bundle['classes'], 'source_hashes': bundle['source_hashes'],
                   'images': {split: [{'file': sample['file'], 'sha256': sample['sha256']}
                                      for sample in samples]
                              for split, samples in bundle['splits'].items()}}
    bundle['dataset_sha256'] = hashlib.sha256(
        json.dumps(fingerprint, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    return bundle
