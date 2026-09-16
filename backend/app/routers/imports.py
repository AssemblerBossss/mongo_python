import asyncio
from typing import Annotated

from fastapi import APIRouter, File, UploadFile

from app.dependencies import ImportServiceDep
from app.schemas.imports import ImportPayload, ImportSummary

router = APIRouter(prefix="/api")


@router.post("/imports", response_model=ImportSummary, status_code=201)
def import_documents(
    payload: ImportPayload, service: ImportServiceDep
) -> ImportSummary:
    return service.import_records(payload)


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

    return await asyncio.to_thread(service.import_files, files_by_name)
