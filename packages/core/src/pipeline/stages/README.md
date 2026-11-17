# Pipeline stages

One file per stage, each implementing `PipelineStage`. Planned ports from `converter/pipeline/`:

| Stage | Source (Python) |
|---|---|
| `MediaResolutionStage.ts` | `media.py` — attachment detection, MIME, omitted media |
| `StickerAnimationStage.ts` | `media.py` — animated WebP detection / loop patch |
| `EditedMessageStage.ts` | `media.py` — `EDITED_PATTERN` |
| `DirectionStage.ts` | `service.py` — `_resolve_participants` |
| `TimestampStage.ts` | `service.py` — `_detect_date_order` |
| `LinkExtractionStage.ts` | `link.py` |
