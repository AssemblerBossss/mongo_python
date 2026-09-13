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

