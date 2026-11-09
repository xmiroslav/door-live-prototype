# Door Live — batch 01 manual annotation review
Date: 2026-11-09

Seven user-supplied mobile photos have received approximate visual quadrilateral drafts in a separate downloadable ZIP in the conversation. **These are not verified ground truth, and no model training has run.** Original images and JSON are in that archive, not committed here.

| Image | State | Corner status |
|---|---|---|
| IMG_9662.jpeg | open | some corner inference due to foreground door |
| IMG_9661.jpeg | ajar | heavily occluded right jamb |
| IMG_9660.jpeg | ajar | right jamb occluded |
| IMG_9659.jpeg | ajar | visible frame, perspective |
| IMG_9529(2).jpeg | empty | visible dark frame |
| IMG_9528(3).jpeg | closed | low contrast white on white |
| IMG_9509(4).jpeg | closed | angled view |

**Before training**: visually review and correct all four corners against original-resolution photos; distinguish inner clear opening from outer trim; keep occluded-corner visibility flags; confirm rights of source images. No claims of model accuracy or deployment are justified yet. Catalog batch remains quarantined pending provenance.
