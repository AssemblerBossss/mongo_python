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