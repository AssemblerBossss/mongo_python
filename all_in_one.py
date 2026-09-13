# ===== ./all_in_one.py =====

# ===== ./app/config.py =====
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    mongo_host: str = os.getenv("MONGO_HOST", "localhost")
    mongo_port: int = int(os.getenv("MONGO_PORT", "27017"))
    mongo_username: str = os.getenv("MONGO_USERNAME", "admin")
    mongo_password: str = os.getenv("MONGO_PASSWORD", "admin")
    mongo_db: str = os.getenv("MONGO_DB", "datasets")


settings = Settings()

# ===== ./app/database.py =====
"""Точка входа к БД для REST API.

Подключение к MongoDB не переизобретается — используется учебный класс
MongoDBConnection из python_project/database.py. Сервисный слой (MongoService)
строится на его методах (get_collection, find, count, insert_many), в точности
как это делают solution.py и examples.py.
"""
from functools import lru_cache

from python_project.database import MongoDBConnection

from app.config import settings
from app.services.mongo_service import MongoService


@lru_cache
def get_connection() -> MongoDBConnection:
    connection = MongoDBConnection(
        host=settings.mongo_host,
        port=settings.mongo_port,
        username=settings.mongo_username,
        password=settings.mongo_password,
        db_name=settings.mongo_db,
    )
    connection.connect()
    return connection


def get_service() -> MongoService:
    return MongoService(get_connection())

# ===== ./app/__init__.py =====

# ===== ./app/main.py =====
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

# ===== ./app/routers/api.py =====
"""REST API: тонкие ручки, вся логика — в MongoService."""
import json

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_service
from app.services.mongo_service import (
    CollectionExistsError,
    DocumentNotFoundError,
    InvalidObjectIdError,
    MongoService,
)

router = APIRouter(prefix="/api")


# ---------- Коллекции ----------

@router.get("/collections")
def list_collections(service: MongoService = Depends(get_service)):
    return service.list_collections()


@router.post("/collections", status_code=201)
def create_collection(payload: dict, service: MongoService = Depends(get_service)):
    name = str(payload.get("name", "")).strip()
    if not name:
        raise HTTPException(400, "Укажите имя коллекции")
    try:
        service.create_collection(name)
    except CollectionExistsError as e:
        raise HTTPException(409, str(e))
    return {"name": name}


@router.delete("/collections/{name}", status_code=204)
def drop_collection(name: str, service: MongoService = Depends(get_service)):
    try:
        service.drop_collection(name)
    except DocumentNotFoundError as e:
        raise HTTPException(404, str(e))


@router.get("/collections/{name}/fields")
def get_fields(name: str, service: MongoService = Depends(get_service)):
    return service.get_sample_fields(name)


# ---------- Документы ----------

@router.get("/collections/{name}/documents")
def get_documents(
    name: str,
    filter: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    sort_by: str = Query("_id"),
    sort_dir: int = Query(1),
    service: MongoService = Depends(get_service),
):
    query = {}
    if filter:
        try:
            query = json.loads(filter)
        except json.JSONDecodeError:
            raise HTTPException(400, "Некорректный JSON в параметре filter")
        if not isinstance(query, dict):
            raise HTTPException(400, "filter должен быть JSON-объектом")
    documents, total = service.get_documents(name, query, skip, limit, sort_by, sort_dir)
    return {"items": documents, "total": total, "skip": skip, "limit": limit}


@router.post("/collections/{name}/documents", status_code=201)
def create_document(name: str, data: dict, service: MongoService = Depends(get_service)):
    return service.create_document(name, data)


@router.get("/collections/{name}/documents/{doc_id}")
def get_document(name: str, doc_id: str, service: MongoService = Depends(get_service)):
    try:
        return service.get_document(name, doc_id)
    except InvalidObjectIdError as e:
        raise HTTPException(400, str(e))
    except DocumentNotFoundError as e:
        raise HTTPException(404, str(e))


@router.put("/collections/{name}/documents/{doc_id}")
def update_document(name: str, doc_id: str, data: dict, service: MongoService = Depends(get_service)):
    try:
        return service.update_document(name, doc_id, data)
    except InvalidObjectIdError as e:
        raise HTTPException(400, str(e))
    except DocumentNotFoundError as e:
        raise HTTPException(404, str(e))


@router.delete("/collections/{name}/documents/{doc_id}", status_code=204)
def delete_document(name: str, doc_id: str, service: MongoService = Depends(get_service)):
    try:
        service.delete_document(name, doc_id)
    except InvalidObjectIdError as e:
        raise HTTPException(400, str(e))
    except DocumentNotFoundError as e:
        raise HTTPException(404, str(e))

# ===== ./app/routers/__init__.py =====

# ===== ./app/routers/pages.py =====
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

# ===== ./app/services/__init__.py =====

# ===== ./app/services/mongo_service.py =====
"""Сервисный слой: вся бизнес-логика работы с MongoDB в одном месте.

Построен на MongoDBConnection (python_project/database.py) — тот же учебный
класс, которым пользуются solution.py и examples.py. Роутеры (app/routers)
не знают о pymongo — они вызывают методы MongoService и переводят его
исключения в HTTP-ответы.
"""
from __future__ import annotations

from bson import ObjectId
from bson.errors import InvalidId

from python_project.database import MongoDBConnection

from app.utils import serialize_document


class DocumentNotFoundError(Exception):
    """Документ или коллекция не найдены."""


class InvalidObjectIdError(Exception):
    """Некорректный формат идентификатора документа."""


class CollectionExistsError(Exception):
    """Коллекция с таким именем уже существует."""


class MongoService:
    def __init__(self, connection: MongoDBConnection):
        self.connection = connection

    # ---------- Коллекции ----------

    def list_collections(self) -> list[dict]:
        names = sorted(self.connection.db.list_collection_names())
        return [{"name": name, "count": self.connection.count(name)} for name in names]

    def create_collection(self, name: str) -> None:
        if name in self.connection.db.list_collection_names():
            raise CollectionExistsError(f"Коллекция '{name}' уже существует")
        self.connection.db.create_collection(name)

    def drop_collection(self, name: str) -> None:
        if name not in self.connection.db.list_collection_names():
            raise DocumentNotFoundError(f"Коллекция '{name}' не найдена")
        self.connection.db.drop_collection(name)

    def get_sample_fields(self, collection: str, sample_size: int = 25) -> list[str]:
        fields: list[str] = []
        seen = set()
        cursor = self.connection.find(collection)
        if cursor is None:
            return fields
        for doc in cursor.limit(sample_size):
            for key in doc.keys():
                if key not in seen:
                    seen.add(key)
                    fields.append(key)
        return fields

    # ---------- Документы ----------

    @staticmethod
    def _to_object_id(doc_id: str) -> ObjectId:
        try:
            return ObjectId(doc_id)
        except (InvalidId, TypeError):
            raise InvalidObjectIdError(f"Некорректный идентификатор документа: {doc_id}")

    def get_documents(
        self,
        collection: str,
        query: dict | None = None,
        skip: int = 0,
        limit: int = 20,
        sort_by: str = "_id",
        sort_dir: int = 1,
    ) -> tuple[list[dict], int]:
        query = query or {}
        cursor = self.connection.find(collection, query)
        if cursor is None:
            return [], 0
        total = self.connection.count(collection, query)
        documents = [
            serialize_document(doc)
            for doc in cursor.sort(sort_by, sort_dir).skip(skip).limit(limit)
        ]
        return documents, total

    def get_document(self, collection: str, doc_id: str) -> dict:
        object_id = self._to_object_id(doc_id)
        col = self.connection.get_collection(collection)
        doc = col.find_one({"_id": object_id}) if col is not None else None
        if doc is None:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
        return serialize_document(doc)

    def create_document(self, collection: str, data: dict) -> dict:
        data = dict(data)
        data.pop("_id", None)
        inserted_ids = self.connection.insert_many(collection, [data])
        if not inserted_ids:
            raise ValueError("Не удалось создать документ")
        return self.get_document(collection, str(inserted_ids[0]))

    def update_document(self, collection: str, doc_id: str, data: dict) -> dict:
        object_id = self._to_object_id(doc_id)
        data = dict(data)
        data.pop("_id", None)
        col = self.connection.get_collection(collection)
        result = col.replace_one({"_id": object_id}, data)
        if result.matched_count == 0:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
        return self.get_document(collection, doc_id)

    def delete_document(self, collection: str, doc_id: str) -> None:
        object_id = self._to_object_id(doc_id)
        col = self.connection.get_collection(collection)
        result = col.delete_one({"_id": object_id})
        if result.deleted_count == 0:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")

# ===== ./app/utils.py =====
from datetime import datetime
from typing import Any

from bson import ObjectId


def serialize_value(value: Any) -> Any:
    """Преобразует значения MongoDB (ObjectId, datetime, ...) в JSON-совместимые."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [serialize_value(v) for v in value]
    if isinstance(value, dict):
        return serialize_document(value)
    return value


def serialize_document(doc: dict) -> dict:
    return {key: serialize_value(value) for key, value in doc.items()}

# ===== ./generate_data.py =====
import json
import random
from datetime import datetime, timedelta
from faker import Faker

fake = Faker('ru_RU')

def generate_users(num=100):
    users = []
    faculties = ['Информационные технологии', 'Экономика', 'Механика', 'Медицина', 
                 'Физика', 'Юриспруденция', 'Лингвистика', 'Биология', 'Психология',
                 'Химия', 'Математика', 'Философия', 'История', 'Социология']
    
    courses_dict = {
        'Информационные технологии': ['Базы данных', 'Программирование', 'Алгоритмы', 'Сети', 'Математика', 'ОС', 'ИИ'],
        'Экономика': ['Микроэкономика', 'Макроэкономика', 'Статистика', 'Менеджмент', 'Финансы', 'Бухучет'],
        'Медицина': ['Анатомия', 'Биология', 'Химия', 'Физиология', 'Фармакология', 'Хирургия'],
        'Физика': ['Квантовая механика', 'Термодинамика', 'Оптика', 'Электродинамика', 'Ядерная физика'],
        'Лингвистика': ['Английский язык', 'Теория перевода', 'Культурология', 'Фонетика', 'Грамматика']
    }
    
    skills_pool = ['Python', 'Java', 'SQL', 'Git', 'Excel', 'Анализ данных', 'AutoCAD', 
                   'MATLAB', 'Английский', 'Немецкий', 'Статистика', 'C++', 'Linux', 
                   'Docker', 'Kubernetes', 'React', 'Node.js', 'MongoDB', 'PostgreSQL']
    
    countries = ['Россия', 'Казахстан', 'Беларусь', 'Украина', 'Армения', 'Азербайджан', 
                 'Узбекистан', 'Кыргызстан', 'Таджикистан', 'Туркменистан']
    
    for i in range(1, num + 1):
        faculty = random.choice(faculties)
        year = random.randint(1, 5)
        age = random.randint(18, 25)
        
        user = {
            "_id": i,
            "firstName": fake.first_name(),
            "lastName": fake.last_name(),
            "email": f"student{i}@university.edu",
            "age": age,
            "faculty": faculty,
            "year": year,
            "gpa": round(random.uniform(3.0, 5.0), 1),
            "enrollmentDate": f"{2025-year}-{random.randint(9, 12):02d}-{random.randint(1, 28):02d}",
            "courses": random.sample(courses_dict.get(faculty, ['Математика', 'Физика', 'Химия']), 
                                    random.randint(1, 3)),
            "hasScholarship": random.choice([True, False]),
            "dormitoryRoom": f"{random.randint(100, 500)}{random.choice(['A', 'B', 'C'])}" 
                           if random.choice([True, False, False]) else None,
            "phone": fake.phone_number(),
            "birthDate": fake.date_of_birth(minimum_age=18, maximum_age=25).isoformat(),
            "country": random.choice(countries),
            "skills": random.sample(skills_pool, random.randint(1, 5)),
            "internshipCompany": fake.company() if random.choice([True, False]) else None,
            "status": random.choices(['active', 'graduated', 'suspended'], weights=[80, 15, 5])[0],
            "registrationDate": fake.date_time_between(start_date='-2y', end_date='now').isoformat(),
            "lastLogin": fake.date_time_between(start_date='-1y', end_date='now').isoformat(),
            "isInternational": random.choice([True, False]),
            "socialNetworks": {
                "vk": f"vk.com/id{random.randint(1000000, 9999999)}",
                "telegram": f"@{fake.user_name()}",
                "github": f"github.com/{fake.user_name()}"
            } if random.choice([True, False]) else {}
        }
        users.append(user)
    
    with open('datasets/users.json', 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)
    
    print(f"  Сгенерировано {len(users)} пользователей")
    return users

def generate_books(num=100):
    books = []
    genres = ['Роман', 'Фэнтези', 'Детектив', 'Научная фантастика', 'Исторический', 
              'Биография', 'Поэзия', 'Драма', 'Комедия', 'Триллер', 'Учебник',
              'Справочник', 'Мемуары', 'Путешествия', 'Философия', 'Психология']
    
    authors = [
        'Федор Достоевский', 'Лев Толстой', 'Антон Чехов', 'Александр Пушкин',
        'Михаил Булгаков', 'Николай Гоголь', 'Иван Тургенев', 'Владимир Набоков',
        'Джордж Оруэлл', 'Эрнест Хемингуэй', 'Фрэнсис Скотт Фицджеральд',
        'Джоан Роулинг', 'Джон Р. Р. Толкин', 'Агата Кристи', 'Стивен Кинг',
        'Харуки Мураками', 'Дэн Браун', 'Пауло Коэльо', 'Джек Лондон', 'Марк Твен'
    ]
    
    languages = ['Русский', 'Английский', 'Французский', 'Немецкий', 'Испанский', 
                 'Итальянский', 'Китайский', 'Японский', 'Корейский']
    
    publishers = ['Эксмо', 'АСТ', 'Питер', 'Манн, Иванов и Фербер', 'Альпина Паблишер',
                  'Росмэн', 'Дрофа', 'Просвещение', 'Наука', 'Юрайт', 'Лань']
    
    for i in range(1, num + 1):
        book = {
            "_id": i,
            "title": f"{fake.catch_phrase()}",
            "author": random.choice(authors),
            "genre": random.sample(genres, random.randint(1, 3)),
            "year": random.randint(1800, 2023),
            "pages": random.randint(50, 1500),
            "publisher": random.choice(publishers),
            "isbn": f"{random.randint(978, 979)}-{random.randint(0, 9)}-{random.randint(0, 99999)}-{random.randint(0, 9999)}-{random.randint(0, 9)}",
            "language": random.choice(languages),
            "availableCopies": random.randint(0, 15),
            "totalCopies": random.randint(5, 25),
            "price": random.randint(150, 2500),
            "rating": round(random.uniform(2.5, 5.0), 1),
            "tags": random.sample(['классика', 'бестселлер', 'новинка', 'учебник', 
                                  'художественная', 'научная', 'детская', 'юношеская'], 
                                 random.randint(1, 4)),
            "description": fake.text(max_nb_chars=250),
            "location": f"Зал {random.choice(['А', 'Б', 'В', 'Г'])}-{random.randint(1, 10)}",
            "lastBorrowed": fake.date_between(start_date='-1y', end_date='today').isoformat(),
            "isBestSeller": random.choice([True, False]),
            "publicationDate": fake.date_between(start_date='-50y', end_date='today').isoformat(),
            "translator": fake.name() if random.choice([True, False]) else None,
            "edition": random.randint(1, 10),
            "readersCount": random.randint(0, 500),
            "reviewsCount": random.randint(0, 100),
            "avgReadingTime": random.randint(1, 30),
            "keywords": random.sample(['программирование', 'базы данных', 'история', 
                                      'наука', 'литература', 'искусство'], 3)
        }
        books.append(book)
    
    with open('datasets/books.json', 'w', encoding='utf-8') as f:
        json.dump(books, f, ensure_ascii=False, indent=2)
    
    print(f"  Сгенерировано {len(books)} книг")
    return books

if __name__ == "__main__":
    print("Генерация тестовых данных для экзамена MongoDB...")
    users = generate_users(100)
    books = generate_books(100)
    print("Все данные сгенерированы!")
# ===== ./python_project/database.py =====
"""
Модуль для подключения к MongoDB и выполнения базовых операций

Основные классы:
    MongoDBConnection - для управления подключением к базе данных

Основные методы:
    connect() - подключение к MongoDB
    get_collection() - получение коллекции
    find() - поиск документов
    count() - подсчет документов
    aggregation() - агрегационные запросы
    insert_many() - вставка нескольких документов
    print_results() - вывод результатов запроса
"""

from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

class MongoDBConnection:
    """Класс для управления подключением к MongoDB
    
    Позволяет:
    1. Подключаться к MongoDB с аутентификацией или без
    2. Выполнять операции find, count, aggregate, insertMany
    3. Выполнять агрегационные запросы
    4. Работать с несколькими коллекциями
    
    Пример использования:
        >>> db = MongoDBConnection(db_name='my_database')
        >>> db.connect()
        >>> results = db.find('users', {'age': {'$gt': 18}})
        >>> db.print_results(results)
        >>> db.close()
    """
    
    def __init__(self, 
                 host='localhost', 
                 port=27017, 
                 username='admin',
                 password='admin',
                 db_name='test'):
        """
        Инициализация подключения к MongoDB 
        Args:
            host (str): Хост MongoDB (по умолчанию 'localhost')
            port (int): Порт MongoDB (по умолчанию 27017)
            username (str): Имя пользователя для аутентификации
            password (str): Пароль для аутентификации
            db_name (str): Имя базы данных (по умолчанию 'local') 
        Пример:
            # Подключение без аутентификации
            db = MongoDBConnection(db_name='my_db') 
            # Подключение с аутентификацией
            db = MongoDBConnection(
                username='admin',
                password='password',
                db_name='my_db'
            )
        """
        self.client = None  # Клиент MongoDB
        self.db = None      # Объект базы данных
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.db_name = db_name
    
    def connect(self):
        """Установка соединения с MongoDB
        Returns:
            bool: True если подключение успешно, False в противном случае
        Raises:
            ServerSelectionTimeoutError: Если сервер MongoDB недоступен
            ConnectionFailure: При других ошибках подключения
        Пример:
            >>> db = MongoDBConnection()
            >>> if db.connect():
            >>>     print("Успешное подключение")
            >>> else:
            >>>     print("Ошибка подключения")
        """
        try:
            if self.username and self.password:
                # Подключение с аутентификацией
                connection_string = f"mongodb://{self.username}:{self.password}@{self.host}:{self.port}/{self.db_name}?authSource=admin"
                self.client = MongoClient(connection_string, serverSelectionTimeoutMS=5000)
            else:
                # Подключение без аутентификации
                self.client = MongoClient(self.host, self.port, serverSelectionTimeoutMS=5000)
            
            # Проверка подключения (ping команда)
            self.client.admin.command('ping')
            self.db = self.client[self.db_name]
            
            print(f"Успешное подключение к MongoDB: {self.host}:{self.port}")
            print(f"  База данных: {self.db_name}")
            
            # Выводим список коллекций
            collections = self.db.list_collection_names()
            if collections:
                print(f"  Доступные коллекции: {', '.join(collections)}")
            else:
                print("  Коллекции отсутствуют")
                
            return True
            
        except ServerSelectionTimeoutError:
            print("Не удалось подключиться к MongoDB")
            print(f"  Проверьте, запущен ли MongoDB на {self.host}:{self.port}")
            print("  Возможные причины:")
            print("    1. MongoDB не установлен")
            print("    2. MongoDB не запущен")
            print("    3. Неправильный хост или порт")
            return False
        except ConnectionFailure as e:
            print(f"Ошибка подключения: {e}")
            return False
    
    def close(self):
        """Закрыть соединение с MongoDB
        Всегда закрывайте соединение после работы с базой данных
        для освобождения ресурсов.
        Пример:
            >>> db = MongoDBConnection()
            >>> db.connect()
            >>> # ... работа с БД ...
            >>> db.close()  # Важно: всегда закрывайте соединение
        """
        if self.client:
            self.client.close()
            print("Соединение с MongoDB закрыто")
    
    def __enter__(self):
        """Магический метод для использования в контекстном менеджере (with)
        Пример:
            >>> with MongoDBConnection() as db:
            >>>     # автоматически подключается
            >>>     results = db.find('users', {})
            >>> # автоматически закрывается при выходе из блока
        """
        self.connect()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Магический метод для использования в контекстном менеджере (with)"""
        self.close()

    def get_collection(self, collection_name: str):
        """Получить коллекцию по имени
        Args:
            collection_name (str): Имя коллекции
        Returns:
            pymongo.collection.Collection: Объект коллекции или None если подключение отсутствует
        Пример:
            >>> db = MongoDBConnection()
            >>> db.connect()
            >>> users_collection = db.get_collection('users')
            >>> if users_collection:
            >>>     print(f"Коллекция 'users' получена")
        """
        if self.db is not None:
            return self.db[collection_name]
        print(f"Подключение к БД не установлено. Сначала вызовите connect()")
        return None
    
    def find(self, collection_name, query=None, projection=None):
        """Поиск документов в коллекции
        Args:
            collection_name (str): Имя коллекции
            query (dict, optional): Условия поиска. Если None, возвращает все документы
            projection (dict, optional): Поля для возврата. Если None, возвращает все поля
        Returns:
            pymongo.cursor.Cursor: Курсор с результатами поиска или None при ошибке
        Примеры:
            >>> # Найти все документы в коллекции users
            >>> cursor = db.find('users')
            >>> # Найти с условием
            >>> cursor = db.find('users', {'age': {'$gt': 18}})
            >>> # Найти с проекцией (только определенные поля)
            >>> cursor = db.find('users', {'status': 'active'}, {'name': 1, 'email': 1, '_id': 0})
            >>> # Комбинированный запрос
            >>> cursor = db.find('users', 
            >>>                 {'age': {'$gte': 18, '$lte': 30}, 'city': 'Москва'},
            >>>                 {'_id': 0, 'name': 1, 'age': 1})
        """
        collection = self.get_collection(collection_name)
        if collection is None:
            return None
        try:
            if query is not None and projection is not None:
                return collection.find(query, projection)
            elif query is not None:
                return collection.find(query)
            else:
                return collection.find()
        except Exception as e:
            print(f"Ошибка при выполнении find: {e}")
            return None
    
    def count(self, collection_name, query=None):
        """Подсчитать количество документов в коллекции
        Args:
            collection_name (str): Имя коллекции
            query (dict, optional): Условия поиска. Если None, возвращает все документы
        Returns:
            int: Количество документов или 0 при ошибке
        Пример:
            >>> count = db.count('users', {'status': 'active'})
            >>> print(f"Активных пользователей: {count}")
        """
        collection = self.get_collection(collection_name)
        if collection is None:
            return 0
        try:
            if query is None:
                query = {}
            return collection.count_documents(query)
        except Exception as e:
            print(f"Ошибка при подсчете документов: {e}")
            return 0
    
    def aggregation(self, collection_name, pipeline):
        """Выполнить агрегационный запрос
        Агрегация позволяет выполнять сложные операции обработки данных:
        - Группировка
        - Фильтрация
        - Сортировка
        - Вычисляемые поля
        - Объединение коллекций
        Args:
            collection_name (str): Имя коллекции
            pipeline (list): Список этапов агрегации
        Returns:
            pymongo.command_cursor.CommandCursor: Курсор с результатами агрегации
        Пример:
            >>> pipeline = [
            >>>     {'$match': {'status': 'active'}},
            >>>     {'$group': {'_id': '$city', 'count': {'$sum': 1}}},
            >>>     {'$sort': {'count': -1}}
            >>> ]
            >>> cursor = db.aggregation('users', pipeline)
            >>> db.print_results(cursor)
        """
        collection = self.get_collection(collection_name)
        if collection is None:
            return None
        try:
            return collection.aggregate(pipeline)
        except Exception as e:
            print(f"Ошибка при выполнении агрегации: {e}")
            print(f"  Pipeline: {pipeline}")
            return None
    
    def insert_many(self, collection_name, documents):
        """Вставить несколько документов в коллекцию
        Args:
            collection_name (str): Имя коллекции
            documents (list): Список документов для вставки
        Returns:
            list: Список _id вставленных документов или None при ошибке
        Пример:
            >>> new_users = [
            >>>     {'name': 'Иван', 'age': 25, 'city': 'Москва'},
            >>>     {'name': 'Мария', 'age': 22, 'city': 'Санкт-Петербург'}
            >>> ]
            >>> ids = db.insert_many('users', new_users)
            >>> print(f"Добавлено документов: {len(ids)}")
        """
        collection = self.get_collection(collection_name)
        if collection is None:
            return None
        if not isinstance(documents, list):
            print("Документы должны быть переданы в виде списка")
            return None
        if len(documents) == 0:
            print("Список документов пуст")
            return []
        try:
            result = collection.insert_many(documents)
            print(f"Вставлено {len(result.inserted_ids)} документов в коллекцию '{collection_name}'")
            return result.inserted_ids
        except Exception as e:
            print(f"Ошибка при вставке документов: {e}")
            return None

    def print_results(self, cursor, limit=10, title="Результаты запроса"):
        """Вывести результаты запроса в удобном формате
        Args:
            cursor: Курсор MongoDB (результат find() или aggregate())
            limit (int): Максимальное количество документов для вывода (по умолчанию 10)
            title (str): Заголовок для вывода
        Пример:
            >>> cursor = db.find('users', {'age': {'$gt': 18}})
            >>> db.print_results(cursor, limit=5, title="Пользователи старше 18 лет")
        """
        if cursor is None:
            print(f"{title}: Курсор пустой")
            return
        
        try:
            results = list(cursor.limit(limit))
        except Exception as e:
            print(f"Ошибка при получении результатов: {e}")
            return
        
        if not results:
            print(f"{title}: Нет результатов")
            return
        
        print(f"{title}")
        print(f"{'-'*60}")
        print(f"Найдено документов: {len(results)}{' (первые ' + str(limit) + ')' if len(results) == limit else ''}")
        
        for i, doc in enumerate(results, 1):
            print(f"  {i}.")
            for key, value in doc.items():
                # Форматируем вывод
                if isinstance(value, list):
                    if len(value) > 3:
                        value_str = f"[{', '.join(map(str, value[:3]))}...] ({len(value)} элементов)"
                    else:
                        value_str = f"[{', '.join(map(str, value))}]"
                elif isinstance(value, dict):
                    value_str = f"{{...}} ({len(value)} полей)"
                else:
                    value_str = str(value)
                
                print(f"   {key}: {value_str}")


# ===== ./python_project/examples.py =====
"""
Примеры использования MongoDBConnection для работы с MongoDB

Этот файл содержит примеры:
1. Подключение к базе данных
2. Поиск документов (find)
3. Использование проекций
4. Подсчет документов (count)
5. Агрегационные запросы (aggregation)
6. Вставка документов (insert_many)
7. Работа с несколькими коллекциями

Для запуска примеров убедитесь, что:
1. MongoDB установлен и запущен
2. Есть доступ к базе данных с тестовыми данными
"""

from database import MongoDBConnection



def setup_database():
    """Настройка тестовой базы данных"""
    with MongoDBConnection(host='127.0.0.1', username='admin', password='admin', db_name='test') as conn:
        if conn and conn.db is not None:
            # Коллекция пользователей
            users_col = conn.get_collection('users')
            
            # Очищаем коллекцию
            users_col.delete_many({})
            
            # Добавляем тестовые данные
            test_users = [
                {
                    'name': 'Иван Иванов',
                    'age': 25,
                    'city': 'Москва',
                    'status': 'active',
                    'skills': ['Python', 'SQL', 'Git'],
                    'email': 'ivan@example.com',
                    'email_subscription': True,
                    'registration_date': '2024-01-10'
                },
                {
                    'name': 'Мария Петрова',
                    'age': 30,
                    'city': 'Санкт-Петербург',
                    'status': 'active',
                    'skills': ['Java', 'Spring', 'MongoDB'],
                    'email': 'maria@example.com',
                    'email_subscription': True,
                    'registration_date': '2024-02-15'
                },
                {
                    'name': 'Алексей Сидоров',
                    'age': 22,
                    'city': 'Москва',
                    'status': 'inactive',
                    'skills': ['JavaScript', 'React'],
                    'email': 'alex@example.com',
                    'email_subscription': False,
                    'registration_date': '2024-03-05'
                },
                {
                    'name': 'Екатерина Кузнецова',
                    'age': 28,
                    'city': 'Казань',
                    'status': 'active',
                    'skills': ['Python', 'Docker', 'Kubernetes'],
                    'email': 'ekaterina@example.com',
                    'email_subscription': True,
                    'registration_date': '2024-01-25'
                },
                {
                    'name': 'Дмитрий Смирнов',
                    'age': 35,
                    'city': 'Новосибирск',
                    'status': 'active',
                    'skills': ['C++', 'Linux', 'Python'],
                    'email': 'dmitry@example.com',
                    'email_subscription': False,
                    'registration_date': '2023-12-20'
                }
            ]

            users_col.insert_many(test_users)
            print(f"Добавлено {len(test_users)} тестовых пользователей")
            
            # Коллекция заказов
            orders_col = conn.get_collection('orders')
            orders_col.delete_many({})
            
            test_orders = [
                {"user_id": 1, "product": "Ноутбук", "amount": 1500, "status": "completed", "date": "2024-01-10"},
                {"user_id": 1, "product": "Мышь", "amount": 50, "status": "completed", "date": "2024-01-12"},
                {"user_id": 2, "product": "Книга", "amount": 30, "status": "pending", "date": "2024-01-15"},
                {"user_id": 3, "product": "Наушники", "amount": 200, "status": "completed", "date": "2024-01-18"},
                {"user_id": 4, "product": "Монитор", "amount": 400, "status": "shipped", "date": "2024-01-20"},
                {"user_id": 5, "product": "Клавиатура", "amount": 100, "status": "pending", "date": "2024-01-22"},
            ]
            
            orders_col.insert_many(test_orders)
            print(f"Добавлено {len(test_orders)} тестовых заказов")
            
            return True
    return False



# Примеры использования класса
def example_connections():
    """Демонстрация использования класса MongoDBConnection"""
    
    # Способ 1: Использование контекстного менеджера (рекомендуется)
    print("\n1. Использование контекстного менеджера (with):")
    with MongoDBConnection(host='127.0.0.1', username='admin', password='admin', db_name='test') as conn:
         # Автоматически подключается при входе в блок
        print("   Подключение установлено автоматически")
        print("   Внутри блока with - подключение активно")
        # ... работа с БД ...
    # Автоматически закрывается при выходе из блока
    print("   Выход из блока with - подключение закрыто автоматически")
    
    # Способ 2: Ручное управление подключением
    print("\n2. Ручное управление подключением:")
    db = MongoDBConnection(host='127.0.0.1', username='admin', password='admin', db_name='test')
 
    if db.connect():
        print("  Подключение установлено")
        # ... работа с БД ...
        users_collection = db.get_collection('users')
        if users_collection is not None:
            print(f"  Коллекция 'users' получена")
        db.close()
        print("  Подключение закрыто")
    else:
        print("  Не удалось подключиться")
       


def example_find_operations():
    """Операции поиска (find)"""
    with MongoDBConnection(host='127.0.0.1', username='admin', password='admin', db_name='test') as conn:
       # 1. Найти все документы
        print("\n1. Найти все документы в коллекции 'users':")
        cursor = conn.find('users')
        conn.print_results(cursor, limit=3, title="Все пользователи")

        # 2. Найти с условием
        print("\n2. Найти пользователей старше 25 лет:")
        cursor = conn.find('users', {'age': {'$gt': 25}})
        conn.print_results(cursor, limit=3, title="Пользователи старше 25 лет")
        
        # 3. Найти с несколькими условиями
        print("\n3. Найти активных пользователей из Москвы:")
        cursor = conn.find('users', {
            'status': 'active',
            'city': 'Москва'
        })
        conn.print_results(cursor, limit=3, title="Активные пользователи из Москвы")
        
        # 4. Использование операторов сравнения
        print("\n4. Найти пользователей с возрастом от 20 до 30 лет:")
        cursor = conn.find('users', {
            'age': {'$gte': 20, '$lte': 30}
        })
        conn.print_results(cursor, limit=3, title="Пользователи 20-30 лет")
        
        # 5. Поиск по значению в массиве
        print("\n5. Найти пользователей с определенным навыком:")
        cursor = conn.find('users', {'skills': 'Python'})
        conn.print_results(cursor, limit=3, title="Пользователи со знанием Python")


def example_projection():
    """Использование проекций"""
    with MongoDBConnection(host='127.0.0.1', username='admin', password='admin', db_name='test') as conn:
        # 1. Включение только определенных полей
        print("\n1. Только имя и возраст пользователей:")
        projection = {'name': 1, 'age': 1, '_id': 0}
        cursor = conn.find('users', {}, projection)
        conn.print_results(cursor, limit=3, title="Только имя и возраст")
        
        # 2. Исключение полей
        print("\n2. Все поля кроме пароля и email:")
        projection = {'password': 0, 'email': 0}
        cursor = conn.find('users', {}, projection)
        conn.print_results(cursor, limit=3, title="Без пароля и email")
        
        # 3. Комбинированная проекция с условием
        print("\n3. Активные пользователи - только имя и статус:")
        query = {'status': 'active'}
        projection = {'name': 1, 'status': 1, '_id': 0}
        cursor = conn.find('users', query, projection)
        conn.print_results(cursor, limit=3, title="Активные пользователи (только имя и статус)")


def example_count_documents():
    """Подсчет документов"""
    with MongoDBConnection(host='127.0.0.1', username='admin', password='admin', db_name='test') as conn:
        # 1. Подсчет всех документов
        print("\n1. Подсчет всех пользователей:")
        total_users = conn.count('users')
        print(f"  Всего пользователей: {total_users}")
        
        # 2. Подсчет с условием
        print("\n2. Подсчет активных пользователей:")
        active_users = conn.count('users', {'status': 'active'})
        print(f"  Активных пользователей: {active_users}")
        
        # 3. Подсчет по нескольким условиям
        print("\n3. Подсчет пользователей из Москвы старше 25 лет:")
        moscow_adults = conn.count('users', {
            'city': 'Москва',
            'age': {'$gt': 25}
        })
        print(f"  Пользователей из Москвы старше 25 лет: {moscow_adults}")
        
        # 4. Процентное соотношение
        if total_users > 0:
            active_percentage = (active_users / total_users) * 100
            print(f"  Процент активных пользователей: {active_percentage:.1f}%")


def example_aggregation():
    """Агрегационные запросы"""
    with MongoDBConnection(host='127.0.0.1', username='admin', password='admin', db_name='test') as conn:
        # 1. Группировка по городу
        print("\n1. Количество пользователей по городам:")
        pipeline = [
            {'$group': {
                '_id': '$city',
                'count': {'$sum': 1}
            }},
            {'$sort': {'count': -1}}
        ]
        cursor = conn.aggregation('users', pipeline)
        conn.print_results(cursor, title="Пользователи по городам")
        
        # 2. Средний возраст по статусу
        print("\n2. Средний возраст по статусу:")
        pipeline = [
            {'$group': {
                '_id': '$status',
                'avg_age': {'$avg': '$age'},
                'count': {'$sum': 1}
            }},
            {'$sort': {'avg_age': -1}}
        ]
        cursor = conn.aggregation('users', pipeline)
        conn.print_results(cursor, title="Средний возраст по статусу")
        
        # 3. Сложная агрегация: топ навыков
        print("\n3. Самые популярные навыки:")
        pipeline = [
            {'$unwind': '$skills'},  # Разворачиваем массив навыков
            {'$group': {
                '_id': '$skills',
                'count': {'$sum': 1},
                'avg_age': {'$avg': '$age'}
            }},
            {'$sort': {'count': -1}},
            {'$limit': 5}
        ]
        cursor = conn.aggregation('users', pipeline)
        conn.print_results(cursor, title="Топ-5 популярных навыков")
        
        # 4. Многоэтапная агрегация
        print("\n4. Статистика по городам:")
        pipeline = [
            {'$match': {'status': 'active'}},  # Только активные
            {'$group': {
                '_id': '$city',
                'total': {'$sum': 1},
                'avg_age': {'$avg': '$age'},
                'min_age': {'$min': '$age'},
                'max_age': {'$max': '$age'}
            }},
            {'$match': {'total': {'$gt': 1}}},  # Города с >1 пользователем
            {'$sort': {'total': -1}}
        ]
        cursor = conn.aggregation('users', pipeline)
        conn.print_results(cursor, title="Статистика по городам (активные пользователи)")


def example_insert_data():
    """Вставка данных"""
    with MongoDBConnection(host='127.0.0.1', username='admin', password='admin', db_name='test') as conn:
        # 1. Вставка одного документа
        print("\n1. Вставка нескольких пользователей:")
        new_users = [
            {
                'name': 'Алексей Петров',
                'age': 28,
                'city': 'Новосибирск',
                'status': 'active',
                'skills': ['Python', 'MongoDB', 'Docker'],
                'registration_date': '2024-01-15'
            },
            {
                'name': 'Елена Смирнова',
                'age': 32,
                'city': 'Казань',
                'status': 'active',
                'skills': ['Java', 'Spring', 'SQL'],
                'registration_date': '2024-02-20'
            },
            {
                'name': 'Дмитрий Иванов',
                'age': 24,
                'city': 'Екатеринбург',
                'status': 'inactive',
                'skills': ['JavaScript', 'React', 'Node.js'],
                'registration_date': '2024-03-10'
            }
        ]
        inserted_ids = conn.insert_many('users', new_users)
        if inserted_ids:
            print(f"  Добавлено {len(inserted_ids)} новых пользователей")
            print(f"  ID добавленных документов: {inserted_ids}")
            
            # Показать добавленных пользователей
            print("\n   Добавленные пользователи:")
            for user_id in inserted_ids:
                cursor = conn.find('users', {'_id': user_id})
                conn.print_results(cursor, limit=1, title=f"Пользователь {user_id}")
        else:
            print("  Не удалось добавить пользователей")


def example_multiple_collections():
    """Работа с несколькими коллекциями"""
    with MongoDBConnection(host='127.0.0.1', username='admin', password='admin', db_name='test') as conn:
        # 1. Проверка существующих коллекций
        collections = conn.db.list_collection_names()
        print(f"\n1. Доступные коллекции в базе данных:")
        for i, col in enumerate(collections, 1):
            count = conn.count(col)
            print(f"   {i}. {col}: {count} документов")
        
        # 2. Работа с разными коллекциями
        print("\n2. Пример работы с разными коллекциями:")
        # Если есть коллекция 'orders'
        if 'orders' in collections:
            print("  Коллекция 'orders':")
            cursor = conn.find('orders', {}, {'_id': 0, 'user_id': 1, 'amount': 1})
            conn.print_results(cursor, limit=3, title="Заказы")
        
        # Если есть коллекция 'products'
        if 'products' in collections:
            print("\n  Коллекция 'products':")
            cursor = conn.find('products', {'price': {'$lt': 1000}})
            conn.print_results(cursor, limit=3, title="Товары дешевле 1000")


def example_error_handling():
    """Обработка ошибок"""
    # 1. Попытка подключения к несуществующему серверу
    print("\n1. Подключение к несуществующему серверу:")
    db = MongoDBConnection(host='wrong_host', port=27017)
    if not db.connect():
        print("  Ошибка обработана корректно")

    # 2. Подключение без аутентификационных данных
    print("\n3. Подключение без аутентификационных данных:")
    try:
        db = MongoDBConnection(host='127.0.0.1', db_name='test')
        if not db.connect():
            print("  Ошибка обработана корректно")
    except Exception as e:
        print( f"  Исключение обработано: {e} ")

    # 3. Работа с несуществующей коллекцией
    print("\n3. Поиск в несуществующей коллекции:")
    with MongoDBConnection(host='127.0.0.1', username='admin', password='admin', db_name='test') as conn:
        cursor = conn.find('non_existing_collection')
        if cursor is None:
            print("  Коллекция не найдена, курсор = None")
        
        # 4. Неправильный запрос
        print("\n4. Неправильный формат запроса:")
        cursor = conn.find('users', 'wrong_query_format')  # Должен быть dict
        if cursor is None:
            print("  Некорректный запрос обработан")

        # 5. Агрегация с ошибкой в pipeline
        print("\n5. Агрегация с ошибкой в пайплайне:")
        pipeline = [
            {'$wrong_stage': {}}  # Несуществующий этап
        ]
        cursor = conn.aggregation('users', pipeline)
        if cursor is None:
            print("  Ошибка в пайплайне обработана")


def example_practical_scenarios():
    """Практические сценарии использования"""
    with MongoDBConnection(host='1127.0.0.1', username='admin', password='admin', db_name='test') as conn:
        # Сценарий 1: Поиск пользователей для рассылки
        print("\n1. Поиск пользователей для email-рассылки:")
        query = {
            'status': 'active',
            'email': {'$exists': True, '$ne': None},
            'email_subscription': True
        }
        projection = {'email': 1, 'name': 1, '_id': 0}
        cursor = conn.find('users', query, projection)
        count = conn.count('users', query)
        print(f"  Пользователей для рассылки: {count}")
        conn.print_results(cursor, limit=3, title="Для рассылки")

        # Сценарий 2: Анализ активности пользователей
        print("\n2. Анализ активности по месяцам:")
        pipeline = [
            {'$match': {'registration_date': {'$exists': True}}},
            {'$project': {
                'year_month': {'$substr': ['$registration_date', 0, 7]},
                'status': 1
            }},
            {'$group': {
                '_id': '$year_month',
                'total': {'$sum': 1},
                'active': {
                    '$sum': {
                        '$cond': [{'$eq': ['$status', 'active']}, 1, 0]
                    }
                }
            }},
            {'$sort': {'_id': 1}},
            {'$limit': 6}
        ]
        cursor = conn.aggregation('users', pipeline)
        conn.print_results(cursor, title="Регистрации по месяцам")
        
        # Сценарий 3: Поиск экспертов по навыкам
        print("\n3. Поиск экспертов по определенным навыкам:")
        required_skills = ['Python', 'MongoDB']
        query = {
            'skills': {'$all': required_skills},
            'status': 'active'
        }
        cursor = conn.find('users', query)
        count = conn.count('users', query)
        print(f"  🧑‍💻 Экспертов по {', '.join(required_skills)}: {count}")
        conn.print_results(cursor, limit=3, title="Эксперты")




def run_examples():
    """Запуск примеров"""
    
    # 1. Настройка базы данных
    print("=" * 50)
    print("1. Настройка базы данных")
    print("=" * 50)
    
    setup_database()
    

    # 2. Подключение к БД
    print("\n" + "=" * 50)
    print("2. Подключение к базе данных")
    print("=" * 50)
    
    example_connections()
    

    # 3. Примеры запросов
    print("\n" + "=" * 50)
    print("3. ПРОСТЫЕ ЗАПРОСЫ (FIND)")
    print("=" * 50)
    
    example_find_operations()
    
    
    # 4. ПРОЕКЦИИ
    print("\n" + "=" * 50)
    print("4. ПРОЕКЦИИ (выбор полей)")
    print("=" * 50)

    example_projection()
    

    # 5. COUNT
    print("\n" + "=" * 50)
    print("6. COUNT (подсчет документов)")
    print("=" * 50)

    example_count_documents()


    # 6. АГРЕГАЦИИ
    print("\n" + "=" * 50)
    print("8. АГРЕГАЦИИ")
    print("=" * 50)

    example_aggregation()


    # 7. ВСТАВКА ДАННЫХ
    print("\n" + "=" * 50)
    print("7. ВСТАВКА ДАННЫХ")
    print("=" * 50)

    example_insert_data()


    # 8. РАБОТА С НЕСКОЛЬКИМИ КОЛЛЕКЦИЯМИ
    print("\n" + "=" * 50)
    print("8. РАБОТА С НЕСКОЛЬКИМИ КОЛЛЕКЦИЯМИ")
    print("=" * 50) 

    example_multiple_collections()


    # 9. ОБРАБОТКА ОШИБОК
    print("\n" + "=" * 50)
    print("9. ОБРАБОТКА ОШИБОК")
    print("=" * 50) 

    example_error_handling()


    # 10. ПРАКТИЧЕСКИЕ СЦЕНАРИИ
    print("\n" + "=" * 50)
    print("10. ПРАКТИЧЕСКИЕ СЦЕНАРИИ")
    print("=" * 50) 

    example_practical_scenarios()





if __name__ == "__main__":
    run_examples()


# ===== ./python_project/solution.py =====
from database import MongoDBConnection


class ExamSolution:
    def __init__(self):
        self.db = MongoDBConnection()
        self.db.connect()
        self.users = self.db.get_collection('users')
        self.books = self.db.get_collection('books')

    # Задача 1
    def task_1(self):
        """Найти всех активных студентов факультета 'Экономика' с GPA выше 4.0"""
        result = list(self.users.find({
            "status": "active",
            "faculty": "Экономика",
            "gpa": {"$gt": 4.0}
        }))

        print(f"Найдено студентов: {len(result)}")
        for student in result:
            print(f"{student.get('firstName')} {student.get('lastName')} - GPA: {student.get('gpa')}")
        return result

    # Задача 2
    def task_2(self):
        """Найти студентов, которые либо живут в общежитии, либо имеют стипендию,
           и при этом являются иностранными студентами"""
        result = list(self.users.find({
            "isInternational": True,
            "$or": [
                {"dormitoryRoom": {"$ne": None}},
                {"hasScholarship": True}
            ]
        }))
        print(f"Найдено студентов: {len(result)}")
        for student in result:
            dorm = f"Общежитие: {student.get('dormitoryRoom')}" if student.get('dormitoryRoom') else "Без общежития"
            scholarship = "Стипендия: есть" if student.get('hasScholarship') else "Стипендии нет"
            print(f"{student.get('firstName')} {student.get('lastName')} - {dorm}, {scholarship}")
        return result

    def task_3(self):
        """Вывести только имена, фамилии и факультеты студентов 4-го курса"""

        result = list(self.users.find(
            {"year": 4},
            {
                "_id": 0,
                "firstName": 1,
                "lastName": 1,
                "faculty": 1,
            }
        ))

        print(f"Найдено студентов: {len(result)}")
        for student in result:
            print(f"{student.get('firstName')} {student.get('lastName')} - faculty: {student.get('faculty')}")
        return result

    def task_4(self):
        """Вывести информацию о студентах с вычисляемым полем fullName
        и отфильтровать только тех, у кого в имени есть буква "а"""

        pipeline = [
            {
                "$addFields": {
                    "fullName": {"$concat": ["$firstName", " ", "$lastName"]},
                }
            },
            {
                "$match": {
                    "firstName": {"$regex": "а", "$options": "i"},
                }
            }
        ]

        result = list(self.users.aggregate(pipeline))

        print(f"Найдено студентов: {len(result)}")
        for student in result:
            print(f"{student.get('fullName')} - firstName: {student.get('firstName')}")
        return result

    def task_5(self):
        """Найти студентов с навыком "Python" и средним GPA выше 4.0."""
        result = list(self.users.find(
            {
                "skills": "Python",
                "gpa": {"$gt": 4.0},

            }
        ))

        print(f"Найдено студентов: {len(result)}")
        for student in result:
            print(f"{student.get('firstName')} {student.get('lastName')} - skills: {student.get('skills')}")
        return result

    def task_6(self):
        """Найти студентов, у которых есть "Python" и "SQL" в навыках, и которые либо на 3 курсе, либо на 4 курсе."""
        result = list(self.users.find(
            {
                "skills": {"$all": ["Python", "SQL"]},
                "year": {"$in": [3, 4]}

            }
        ))

        print(f"Студенты с Python и SQL (3-4 курс): {len(result)}")
        for student in result:
            print(f"{student.get('firstName')} {student.get('lastName')} - "
                  f"Курс: {student.get('year')}, Навыки: {', '.join(student.get('skills', []))}")
        return result

    def task_7(self):
        """Вывести топ-3 студента с самым высоким GPA на каждом факультете"""
        pipeline = [
            {
                "$sort": {"faculty": 1, "gpa": -1}
            },
            {
                "$group": {
                    "_id": "$faculty",
                    "students": {"$push": "$$ROOT"}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "faculty": "$_id",
                    "topStudents": {"$slice": ["$students", 3]}
                }
            }
        ]

        """"
         -   _id": "$faculty" — группировка по полю "факультет"
         -   "students": {"$push": "$$ROOT"} — собирает всех студентов факультета в массив

         -   $$ROOT означает "весь документ целиком" (все поля студента)
        
         Результат: Для каждого факультета создаётся один документ, содержащий массив всех
         его студентов (уже отсортированных по GPA).
        """

        result = list(self.users.aggregate(pipeline))

        print("Топ-3 студентов по GPA на каждом факультете:")
        for faculty_data in result:
            print(f"\nФакультет: {faculty_data['faculty']}")
            for student in faculty_data['topStudents']:
                print(f"  {student.get('firstName')} {student.get('lastName')} - GPA: {student.get('gpa')}")

        return result

    def task_8(self):
        """Вывести студентов, отсортированных по факультету (A-Z), затем по году обучения (по возрастанию),
         затем по GPA (по убыванию)."""
        result = list(self.users.find().sort(
            [
                ("faculty", 1),
                ("year", 1),
                ("gpa", -1),
            ]
        ))

        print(f"Все студенты с сортировкой: {len(result)}")
        for student in result[:10]:  # Выводим первые 10 для примера
            print(f"{student.get('faculty')} | Курс: {student.get('year')} | "
                  f"GPA: {student.get('gpa')} | {student.get('firstName')} {student.get('lastName')}")

        return result

    def task_9(self):
        """Посчитать средний GPA и количество студентов для каждого статуса"""
        pipeline = [
            {
                "$group": {
                    "_id": "$status",
                    "avgGPA": {"$avg": "$gpa"},
                    "count": {"$sum": 1}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "status": "$_id",
                    "avgGPA": {"$round": ["$avgGPA", 2]},
                    "count": 1

                }
            }
        ]

        result = list(self.users.aggregate(pipeline))
        print("Статистика по статусам студентов:")
        for stat in result:
            print(f"Статус: {stat['status']} - "
                  f"Средний GPA: {stat['avgGPA']}, Количество: {stat['count']}")

        return result


    def task_10(self):
        """Для каждого факультета найти:
        - средний GPA
        - количество студентов со стипендией
        - процент иностранных студентов
        - самый распространенный год обучения
        """

        avg_gpa_pipeline = [
            {
                "$group": {
                    "_id": "$faculty",
                    "avgGPA": {"$avg": "$gpa"},
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "faculty": "$_id",
                    "avgGPA": {"$round": ["$avgGPA", 2]},
                }
            }
        ]
        avg_gpa = list(self.users.aggregate(avg_gpa_pipeline))

        result = {}

        for item in avg_gpa:
            faculty = item['faculty']
            result[faculty] = {'avgGPA': item['avgGPA']}

        print("Статистика по факультетам:")
        for faculty, data in sorted(result.items()):
            print(f"\nФакультет: {faculty}")
            print(f"  Средний GPA: {data.get('avgGPA', 'N/A')}")
            print(f"  Стипендия: {data.get('scholarshipCount', 0)} студентов")
            print(f"  Иностранных: {data.get('internationalPercentage', 0)}%")
            print(f"  Самый распространенный курс: {data.get('mostCommonYear', 'N/A')}")



if __name__ == "__main__":
    solution = ExamSolution()
    #solution.task_1()
    #solution.task_2()
    #solution.task_3()
    #solution.task_4()
    #solution.task_5()
    #solution.task_6()
    #solution.task_7()
    #solution.task_8()
    #solution.task_9()
    solution.task_10()



# # Найти все версии >= 6
# db.phones.find({
#     "bluetooth": {"$regex": "^[6-9]"}
# })
#
# # Найти версии 5b, 5c, ..., 5z (больше чем 5a)
# db.phones.find({
#     "$or": [
#         {"bluetooth": {"$regex": "^[6-9]"}},  # 6+
#         {"bluetooth": {"$regex": "^5[b-z]"}}  # 5b, 5c, ...
#     ]
# })


# def parse_bluetooth(version_str):
#     """Преобразует '5a' в (5, 'a')"""
#     num = int(version_str[:-1])
#     letter = version_str[-1]
#     return (num, letter)
#
# # Получаем все телефоны
# phones = list(db.phones.find())
#
# # Фильтруем в Python
# target = parse_bluetooth("5a")
# filtered = [
#     phone for phone in phones
#     if parse_bluetooth(phone['bluetooth']) > target
# ]


