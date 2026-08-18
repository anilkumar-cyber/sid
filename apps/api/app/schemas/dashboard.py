from datetime import datetime

from pydantic import BaseModel


class ActionItem(BaseModel):
    id: str
    category: str
    priority: str  # critical | high | medium | informational
    title: str
    count: int
    link: str
    detail: str | None = None


class ActionCenterOut(BaseModel):
    items: list[ActionItem]
    generated_at: datetime
