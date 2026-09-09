from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.routers import api, pages

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(
    title="Mongo Admin",
    description="Простой REST API и веб-интерфейс для работы с MongoDB без авторизации",
)

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

app.include_router(pages.router)
app.include_router(api.router)
