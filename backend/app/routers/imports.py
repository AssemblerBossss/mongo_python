import asyncio
from typing import Annotated

from fastapi import APIRouter, Request, File, UploadFile

from app.dependencies import ImportServiceDep
from app.schemas.imports import ImportSummary, ImportPayload

router = APIRouter(prefix="/api")


def _import_request_schema() -> dict:
    """JSON-схема тела /imports для Swagger (сам разбор идёт вручную через parse_file)."""
    schema = ImportPayload.model_json_schema()
    defs = schema.pop("$defs")
    schema["additionalProperties"]["items"] = defs["ScanRecord"]
    return schema


@router.post(
    "/imports",
    response_model=ImportSummary,
    status_code=201,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {"application/json": {"schema": _import_request_schema()}},
        }
    },
)
async def import_documents(
    request: Request, service: ImportServiceDep
) -> ImportSummary:
    body = await request.body()
    payload = await asyncio.to_thread(service.parse_file, "тело запроса", body)
    return await service.import_records(payload)


@router.post("/imports/files", response_model=ImportSummary, status_code=201)
async def import_document_files(
    service: ImportServiceDep,
    files: Annotated[
        list[UploadFile],
        File(
            description="Один или несколько файлов; адрес берётся из содержимого файла"
        ),
    ],
) -> ImportSummary:
    """Принимает один или несколько файлов.

    Чтение файлов идёт параллельно через async I/O, а разбор JSON и запись в
    Mongo вынесены в отдельный поток, чтобы большие файлы не блокировали event
    loop и не мешали другим одновременным загрузкам.
    """
    contents = await asyncio.gather(*(file.read() for file in files))
    filenames = [file.filename or f"file_{index}" for index, file in enumerate(files)]
    files_by_name = dict(zip(filenames, contents))

    return await service.import_files(files_by_name)
