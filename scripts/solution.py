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

