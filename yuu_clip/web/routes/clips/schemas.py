"""Request bodies for the clip API - one pydantic model per mutating route."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

_VALID_STATUSES = ("approved", "rejected", "pending")


class StatusUpdate(BaseModel):
    status: str  # approved | rejected | pending


class ClipFieldsUpdate(BaseModel):
    action: str                          # accept_new | accept_edit | revert
    field: str                           # description | description_long | both
    new_description: Optional[str] = None
    new_description_long: Optional[str] = None


class ClipTimingUpdate(BaseModel):
    start_offset: float
    end_offset: float


class ClipScoreOverride(BaseModel):
    score_overall_user: Optional[float] = None  # None = clear override


class ClipFramingUpdate(BaseModel):
    crop_x: Optional[float] = None  # 0..1 horizontal 9:16 crop position; None = center


class ClipMergeRequest(BaseModel):
    clip_b_id: int


class BulkStatusUpdate(BaseModel):
    clip_ids: list[int]
    status: str  # approved | rejected | pending


class BulkStatusRestoreItem(BaseModel):
    id: int
    status: str  # approved | rejected | pending


class BulkStatusRestore(BaseModel):
    updates: list[BulkStatusRestoreItem]


class BulkClipIds(BaseModel):
    clip_ids: list[int]


class CaptionSegmentUpdate(BaseModel):
    text: str


class AutoApproveBody(BaseModel):
    threshold: float
    score_field: str = "overall"


class TagsBody(BaseModel):
    tags: list[str] = []


class ManualClipCreate(BaseModel):
    start_ms: int
    end_ms: int
