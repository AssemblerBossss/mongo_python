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

