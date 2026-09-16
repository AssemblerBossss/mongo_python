from typing import Any

from pydantic import BaseModel


class AggregateRequest(BaseModel):
    pipeline: list[dict[str, Any]] = []
    limit: int | None = None


class SchemaAnalyzeRequest(BaseModel):
    sampleSize: int | None = None
