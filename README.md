# HR Command Center

Полноценное веб-приложение для HR-менеджеров с аналитикой и AI-модулями:
- AI-скоринг кандидатов (TF-IDF + cosine similarity)
- Прогноз риска оттока сотрудников (Logistic Regression)
- Дашборды, онбординг, обучение, договоры ГПХ

## Стек

### Backend
- Python 3.11+
- FastAPI
- SQLAlchemy
- SQLite
- scikit-learn

### Frontend
- React 18 + Vite
- Tailwind CSS
- Recharts

## Структура проекта

```text
/backend   -> FastAPI API, модели БД, сиды, AI-модули
/frontend  -> React приложение (дашборд и страницы HR)
```

## 1) Запуск backend

Откройте терминал в корне проекта и выполните:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Backend будет доступен по адресу:
- API: http://localhost:8000
- Swagger: http://localhost:8000/docs

> При первом запуске автоматически создаются таблицы SQLite и заполняются реалистичными тестовыми данными на русском языке.

## 2) Запуск frontend

В новом терминале:

```powershell
cd frontend
npm install
npm run dev
```

Frontend будет доступен по адресу:
- http://localhost:5173

## Ключевые API-эндпоинты

- `GET/POST /api/vacancies`
- `GET/POST/PUT /api/candidates`
- `GET /api/candidates/{id}/rescore`
- `GET /api/employees?department=&status=`
- `GET /api/analytics`
- `GET /api/analytics/churn-risk`
- `GET/POST/PUT /api/onboarding/{employee_id}/tasks`
- `GET /api/training`
- `GET/POST /api/contracts`
- `POST /api/contracts/{id}/generate-act`

## AI-модули

### 1. Resume Scoring (`backend/ai_scoring.py`)
- Строит TF-IDF по двум документам:
  - текст кандидата (`resume_text + skills`)
  - текст вакансии (`required_skills_text + description`)
- Возвращает score от 0 до 100
- Автоматически вызывается при создании кандидата
- Можно пересчитать через `GET /api/candidates/{id}/rescore`

### 2. Churn Prediction (`backend/ai_churn.py`)
- Модель: `LogisticRegression`
- Признаки:
  - `tenure_months`
  - `avg_engagement`
  - `is_remote`
  - `salary`
  - `department` (через `LabelEncoder`)
- Обучение выполняется при старте backend на seed-данных
- Прогноз доступен через `GET /api/analytics/churn-risk`

## Примечания по безопасности и качеству

- Включен CORS только для `http://localhost:5173`
- Выполнена серверная валидация статусов и категорий
- На backend используются типизированные Pydantic-модели
- Все вычисления сумм по договорам выполняются на сервере

## База данных

SQLite файл создается автоматически в корне проекта:
- `hr_command_center.db`

Если нужно пересоздать БД с сид-данными:
1. Остановите backend
2. Удалите `hr_command_center.db`
3. Запустите backend заново
