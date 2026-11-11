"""Compact crop-based four-corner model. Architecture only; no trained weights.

Input: RGB float32 NCHW, 256 square, 0..1. Crop extent is known separately.
Outputs: TL/TR/BR/BL heatmap logits at 64 square; four visibility logits.
"""
import math
import torch
from torch import nn
from torch.nn import functional as F


class DoorCornerModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 24, 3, stride=2, padding=1), nn.ReLU(),
            nn.Conv2d(24, 24, 3, padding=1, groups=24), nn.ReLU(),
            nn.Conv2d(24, 48, 1), nn.ReLU(),
            nn.Conv2d(48, 48, 3, stride=2, padding=1, groups=48), nn.ReLU(),
            nn.Conv2d(48, 64, 1), nn.ReLU(),
            nn.Conv2d(64, 64, 3, padding=1, groups=64), nn.ReLU(),
            nn.Conv2d(64, 64, 1), nn.ReLU())
        self.heatmaps = nn.Conv2d(64, 4, 1)
        self.visibility = nn.Linear(64, 4)

    def forward(self, image):
        features = self.features(image)
        return self.heatmaps(features), self.visibility(features.mean(dim=(2, 3)))


def corner_training_loss(heatmaps, visibility_logits, points, visible, sigma_cells=1.5):
    """Only observable corners supervise positions; all corners supervise visibility.

    points are normalized to crop extent. Unknown positions may be NaN only when
    visible=False. Visibility labels require separate verified annotation.
    """
    if heatmaps.ndim != 4 or heatmaps.shape[1] != 4:
        raise ValueError('Expected N,4,H,W heatmaps')
    batch, _, height, width = heatmaps.shape
    if (tuple(visibility_logits.shape) != (batch, 4) or tuple(points.shape) != (batch, 4, 2)
            or tuple(visible.shape) != (batch, 4) or visible.dtype != torch.bool):
        raise ValueError('Incompatible corner target shapes or visibility labels')
    if not isinstance(sigma_cells, (int, float)) or not 0 < sigma_cells < float('inf'):
        raise ValueError('Invalid heatmap target sigma')
    variance = 2.0 * sigma_cells * sigma_cells
    if not math.isfinite(variance) or variance < torch.finfo(heatmaps.dtype).tiny:
        raise ValueError('Heatmap sigma outside numeric precision range')
    observable = points[visible]
    if observable.numel() and (not torch.isfinite(observable).all().item()
                               or (observable < 0).any().item() or (observable > 1).any().item()):
        raise ValueError('Visible corner coordinates must be finite and within crop')
    if not torch.isfinite(heatmaps).all().item() or not torch.isfinite(visibility_logits).all().item():
        raise ValueError('Nonfinite corner-model outputs')
    visibility_loss = F.binary_cross_entropy_with_logits(visibility_logits, visible.to(visibility_logits.dtype))
    if not observable.numel():
        return visibility_loss + heatmaps.flatten()[0] * 0
    x = torch.arange(width, device=heatmaps.device, dtype=heatmaps.dtype)
    y = torch.arange(height, device=heatmaps.device, dtype=heatmaps.dtype)
    center_x = observable[:, 0].to(heatmaps.dtype) * width - .5
    center_y = observable[:, 1].to(heatmaps.dtype) * height - .5
    squared = ((x[None, None, :] - center_x[:, None, None]) ** 2
               + (y[None, :, None] - center_y[:, None, None]) ** 2)
    targets = torch.softmax((-squared / variance).flatten(1), dim=1)
    log_prediction = F.log_softmax(heatmaps[visible].flatten(1), dim=1)
    location_loss = -(targets * log_prediction).sum(dim=1).mean()
    return location_loss + visibility_loss
