# Python-проект для экзамена по MongoDB

## Описание
Этот проект содержит инструменты для работы с MongoDB в рамках практической части экзамена по дисциплине "Безопасность систем баз данных".

## Структура проекта

### Основные файлы:
- `database.py` - класс MongoDBConnection - подключение к MongoDB и выполнение запросов
- `examples.py` - Примеры использования MongoDBConnection
- `requirements.txt` - Зависимости Python

### Дополнительные файлы:
- `generate_data.py` - Генератор тестовых данных

## Установка и настройка

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
