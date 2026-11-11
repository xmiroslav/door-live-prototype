"""Group-aware penalty selection on training data only, for research."""
import numpy as np
from pretrained_corner_probe import ridge_head


def group_folds(groups):
    groups = np.asarray(groups)
    unique = sorted(set(groups.tolist()))
    if len(unique) < 2:
        raise ValueError('at least two physical doorway groups required')
    for group in unique:
        yield np.flatnonzero(groups != group), np.flatnonzero(groups == group)


def select_penalty(x, y, groups, penalties):
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    if len(x) != len(y) or len(x) != len(groups) or not penalties:
        raise ValueError('invalid cross-validation input')
    scores = {}
    for penalty in penalties:
        if penalty <= 0:
            raise ValueError('penalty must be positive')
        errors = []
        for train, held in group_folds(groups):
            # Scale is fitted on the fold's training rows, never held-out rows.
            scale = float(np.sqrt(np.mean(x[train] ** 2)))
            if not scale:
                raise ValueError('zero feature scale')
            w, b = ridge_head(x[train] / scale, y[train], penalty)
            diff = (x[held] / scale @ w + b - y[held]).reshape(-1, 4, 2)
            # All 21 source photographs have this portrait aspect ratio.
            weighted = diff * np.array([864, 1536]) / np.hypot(864, 1536)
            errors.append(float(np.mean(np.linalg.norm(weighted, axis=2))))
        scores[str(penalty)] = float(np.mean(errors))
    choice = min(penalties, key=lambda penalty: (scores[str(penalty)], penalty))
    return {'selected_penalty': choice, 'mean_group_error_by_penalty': scores,
            'folds': len(set(groups))}
