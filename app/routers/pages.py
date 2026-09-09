"""HTML-страницы на Jinja2. Вся логика вынесена в JS, дергающий /api/*."""
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

router = APIRouter()


@router.get("/")
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/collections/{name}")
def collection_page(request: Request, name: str):
    return templates.TemplateResponse(
        "collection.html", {"request": request, "collection_name": name}
    )
