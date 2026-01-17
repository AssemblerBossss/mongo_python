# Работа с СУБД Mongo: Практическая часть экзамена - инструкция для студента

__Время выполнения: 30 минут__

__Максимальный балл: 50 баллов__

---

## Общая информация

**Цель экзамена:** Проверить умения работы с MongoDB, включая создание запросов, агрегаций и работы с данными.

**Оборудование:**
- АРМ с установленным python и docker
- Среда разработки (VS Code, PyCharm и т.д.)


---

## Часть 1: Подготовка инфраструктуры

Инфраструктура состоит из следующих компонентов:

1. Докер-контейнеры (`mongo`, `mongo-express`)
2. JSON-файлы с данными
3. Python-проект для работы с СУБД Mongo и решения задач
4. Вариант с задачами

### Докер-контейнеры

#### Описание контейнеров

Для автоматического запуска всех необходимых контейнеров неоюходимо подготовить файл `docker-compose.yaml`:

```yaml
version: '3.9'

services:
  mongo:
    hostname: mongo
    image: mongo:8
    ports:
      - 27017:27017
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: admin
      MONGO_INITDB_DATABASE: datasets
    volumes:
      - mongo_data:/data/db
      - ./datasets:/var/opt/mongo/datasets
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 10s
      retries: 5
      start_period: 30s
     
  mongo-express:
    hostname: mongo-express
    image: mongo-express
    ports:
      - 8081:8081
    depends_on:
      mongo:
        condition: service_healthy
    environment:
      ME_CONFIG_MONGODB_SERVER: mongo
      ME_CONFIG_MONGODB_PORT: 27017
      ME_CONFIG_MONGODB_ADMINUSERNAME: admin
      ME_CONFIG_MONGODB_ADMINPASSWORD: admin
      ME_CONFIG_MONGODB_ENABLE_ADMIN: true
      # доступ к web-интерфейсу
      ME_CONFIG_BASICAUTH_USERNAME: admin
      ME_CONFIG_BASICAUTH_PASSWORD: admin

volumes:
  mongo_data:

```

#### Запуск контейнеров

Запуск контейнеров осуществляется командой

```bash
docker compose up -d
```

#### Проверка статуса контейнеров

Проверка статуса контейнеров осуществляется командой:

```bash
docker ps
```

Должны быть видны два контейнера: `mongo` (состояние: healthy) и `mongo-express`.

#### Проверка веб-интерфейса

После запуска контейнеров необходимо проверить работу `mongo-express`.

1. Откройте браузер
2. Перейдите по адресу: http://localhost:8081
3. Авторизуйтесь:
	- Логин: `admin`
	- Пароль: `admin`
4. Убедитесь, что видите базу данных `datasets`.

#### Остановка контейнеров

Остановка с сохранением данных:

```bash
docker compose down
```

Остановка с полной очисткой контейнеров и содержимого базы данных:

```bash
docker compose down -v --remove-orphans
docker volume prune -f
```

## Часть 2: Импорт данных

### 2.1: Генерация данных

_Можно использовать уже готовые файлы и пропустить данный шаг!_

Для генерации тестовых данных необходимо воспользоваться файлом `datasets/generate_data.py`. Для этого необходимо выполнить команду:

```bash
pip install faker
python generate_data.py
```

Убедитесь, что создались файлы:

- `datasets/users.json` (100 документов)
- `datasets/books.json` (100 документов)


### Импорт в СУБД вручную (mongoimport)

1. Узнать полное имя контейнера mongo с помощью команды: 
	```bash
	docker ps
	```

2. Выполнить в контейнере mongo команду (подставив вместо _mongo-1_ имя контейнера mongo):

```bash
# Импорт пользователей
docker exec -i mongo-1 mongoimport \
  --drop \
  --db datasets \
  --collection users \
  --username admin \
  --password admin \
  --authenticationDatabase admin \
  --jsonArray < datasets/users.json

# Импорт книг
docker exec -i mongo-1 mongoimport \
  --drop \
  --db datasets \
  --collection books \
  --username admin \
  --password admin \
  --authenticationDatabase admin \
  --jsonArray < datasets/books.json
```

### Проверка результата импорта

1. В браузере перейдите по URL: http://localhost:8081
	- логин: admin
	- пароль: admin

2. Найдите базу данных `datasets` и проверьте наличие коллекций `users` и `books`.
3. Выберите каждую коллекцию и проверьте количество документов в них.

### Python-проект для экзамена по MongoDB

#### Описание

Этот проект содержит инструменты для работы с MongoDB в рамках практической части экзамена.

#### Структура проекта

__Основные файлы:__

- `database.py` - класс MongoDBConnection - подключение к MongoDB и выполнение запросов
- `examples.py` - Примеры использования MongoDBConnection
- `requirements.txt` - Зависимости Python
- `solution.py` - Решение задач

__Дополнительные файлы:__

- `generate_data.py` - Генератор тестовых данных

#### Установка и настройка

1. Создание виртуального окружения
	```bash
	python -m venv venv
	```

2. Активация venv
  
	На ОС Windows:

	```bash
	venv\Scripts\activate
	```

	На ОС Linux:

	```bash
	source venv/bin/activate
	```

3. Установка зависимостей

	```bash
	pip install -r requirements.txt
	```

4. Проверка подключения

	Запустите тестовый скрипт:

	```bash
	python examples.py
	```
	
	Убедитесь, что видите сообщение об успешном подключении.


## Часть 3: Решение задач

### Формат решения

Решение задач реализуется в файле `solution.py`.

Для каждой задачи необходимо написать:

1. Комментарий с номером задачи

2. Запрос к MongoDB, решающий задачу

3. Результат (количество документов и первые 5-10 документов) - выводить в консоль


Пример:

```python
def task_1(self):
    """Найти всех студентов факультета IT с GPA > 4.0"""
    query = {"faculty": "Информационные технологии", "gpa": {"$gt": 4.0}}
    results = self.users.find(query).limit(5)
    
    print("Задача 1: Студенты IT с GPA > 4.0")
    for doc in results:
        print(f"- {doc['firstName']} {doc['lastName']}: GPA={doc['gpa']}")
    print(f"Всего документов: {results.count()}")
```

## Полезные материалы

### Темы для изучения

1. Основы MongoDB

2. Синтаксис запросов

3. Агрегационные операции

4. PyMongo библиотека

### Операторы MongoDB

`$gt`, `$gte`, `$lt`, `$lte` - сравнения

`$in`, `$nin` - вхождение в массив

`$and`, `$or`, `$not` - логические операторы

`$regex` - регулярные выражения

`$size` - размер массива

### Методы PyMongo

`find()` - поиск документов

`find_one()` - поиск одного документа

`count_documents()` - подсчет

`aggregate()` - агрегация

`sort()` - сортировка

`limit()` - ограничение

### Документация

[MongoDB Documentation](https://www.mongodb.com/docs/)

[PyMongo Documentation](https://pymongo.readthedocs.io/)

[Docker Documentation](https://docs.docker.com/)

[MongoDB Aggregation Framework](https://www.mongodb.com/docs/manual/aggregation/)

[PyMongo Tutorial](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/)
