from pydantic import BaseModel


class SchemaAnalyzeRequest(BaseModel):
    sampleSize: int | None = None
