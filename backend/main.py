from __future__ import annotations

import json
import random

import httpx
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import (
    Boolean,
    Date,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    DateTime,
    and_,
    create_engine,
    func,
    or_,
)
from sqlalchemy.orm import DeclarativeBase, Session, mapped_column, relationship, sessionmaker

from ai_churn import ChurnModelBundle, predict_churn, train_churn_model
from ai_llm import LLM_BASE_URL, send_to_llm
from ai_scoring import score_candidate
from auth import create_access_token, verify_token, hash_password, verify_password
from reports import generate_salary_boxplot, generate_engagement_heatmap, generate_churn_factors, generate_hiring_funnel, generate_remote_vs_office
from PyPDF2 import PdfReader
from io import BytesIO

DATABASE_URL = "sqlite:///./hr_command_center.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class HRUser(Base):
    __tablename__ = "hr_users"

    id = mapped_column(Integer, primary_key=True, index=True)
    username = mapped_column(String(100), unique=True, nullable=False, index=True)
    email = mapped_column(String(255), unique=True, nullable=False)
    full_name = mapped_column(String(200), nullable=False)
    hashed_password = mapped_column(Text, nullable=False)
    created_at = mapped_column(DateTime, default=datetime.utcnow)


class Employee(Base):
    __tablename__ = "employees"

    id = mapped_column(Integer, primary_key=True, index=True)
    name = mapped_column(String(150), nullable=False)
    email = mapped_column(String(255), unique=True, nullable=False, index=True)
    department = mapped_column(String(100), nullable=False, index=True)
    position = mapped_column(String(150), nullable=False)
    hire_date = mapped_column(Date, nullable=False)
    status = mapped_column(String(20), nullable=False, index=True)
    salary = mapped_column(Float, nullable=False)
    is_remote = mapped_column(Boolean, default=False)
    fired_date = mapped_column(Date, nullable=True)

    surveys = relationship("EngagementSurvey", back_populates="employee", cascade="all, delete-orphan")
    onboarding_tasks = relationship("OnboardingTask", back_populates="employee", cascade="all, delete-orphan")
    training_records = relationship("TrainingRecord", back_populates="employee", cascade="all, delete-orphan")


class Vacancy(Base):
    __tablename__ = "vacancies"

    id = mapped_column(Integer, primary_key=True, index=True)
    title = mapped_column(String(150), nullable=False)
    department = mapped_column(String(100), nullable=False, index=True)
    required_skills_text = mapped_column(Text, nullable=False)
    description = mapped_column(Text, nullable=False)

    candidates = relationship("Candidate", back_populates="vacancy")


class Candidate(Base):
    __tablename__ = "candidates"

    id = mapped_column(Integer, primary_key=True, index=True)
    name = mapped_column(String(150), nullable=False)
    email = mapped_column(String(255), unique=True, nullable=False, index=True)
    vacancy_id = mapped_column(Integer, ForeignKey("vacancies.id"), nullable=False)
    resume_text = mapped_column(Text, nullable=False)
    skills_json = mapped_column(Text, nullable=False)
    experience_years = mapped_column(Float, nullable=False)
    ai_score = mapped_column(Float, nullable=True)
    status = mapped_column(String(20), nullable=False, default="new", index=True)
    applied_date = mapped_column(Date, nullable=False)

    vacancy = relationship("Vacancy", back_populates="candidates")


class OnboardingTask(Base):
    __tablename__ = "onboarding_tasks"

    id = mapped_column(Integer, primary_key=True, index=True)
    employee_id = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    title = mapped_column(String(200), nullable=False)
    description = mapped_column(Text, nullable=False)
    due_date = mapped_column(Date, nullable=False)
    is_completed = mapped_column(Boolean, default=False)
    category = mapped_column(String(20), nullable=False)

    employee = relationship("Employee", back_populates="onboarding_tasks")


class EngagementSurvey(Base):
    __tablename__ = "engagement_surveys"

    id = mapped_column(Integer, primary_key=True, index=True)
    employee_id = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    date = mapped_column(Date, nullable=False)
    score_1_to_10 = mapped_column(Integer, nullable=False)
    comment = mapped_column(Text, nullable=False)

    employee = relationship("Employee", back_populates="surveys")


class TrainingRecord(Base):
    __tablename__ = "training_records"

    id = mapped_column(Integer, primary_key=True, index=True)
    employee_id = mapped_column(Integer, ForeignKey("employees.id"), nullable=False)
    course_name = mapped_column(String(200), nullable=False)
    status = mapped_column(String(20), nullable=False)
    start_date = mapped_column(Date, nullable=False)
    end_date = mapped_column(Date, nullable=True)

    employee = relationship("Employee", back_populates="training_records")


class ContractGPH(Base):
    __tablename__ = "contracts_gph"

    id = mapped_column(Integer, primary_key=True, index=True)
    contractor_name = mapped_column(String(200), nullable=False)
    contract_number = mapped_column(String(100), nullable=False, unique=True)
    month = mapped_column(String(20), nullable=False)
    hours_worked = mapped_column(Float, nullable=False)
    hourly_rate = mapped_column(Float, nullable=False)
    total_amount = mapped_column(Float, nullable=False)
    status = mapped_column(String(20), nullable=False)
    jira_tasks_json = mapped_column(Text, nullable=False)


EMPLOYEE_STATUSES = {"active", "onboarding", "fired"}
CANDIDATE_STATUSES = {"new", "screening", "interview", "offer", "rejected"}
TRAINING_STATUSES = {"planned", "in_progress", "completed"}
ONBOARDING_CATEGORIES = {"documents", "access", "training", "intro"}
CONTRACT_STATUSES = {"draft", "approved", "signed"}
RUS_MONTH_SHORT = {
    1: "Янв",
    2: "Фев",
    3: "Мар",
    4: "Апр",
    5: "Май",
    6: "Июн",
    7: "Июл",
    8: "Авг",
    9: "Сен",
    10: "Окт",
    11: "Ноя",
    12: "Дек",
}


class AuthLoginRequest(BaseModel):
    username: str
    password: str


class AuthRegisterRequest(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    password: str


class VacancyBase(BaseModel):
    title: str = Field(min_length=2)
    department: str = Field(min_length=2)
    required_skills_text: str = Field(min_length=10)
    description: str = Field(min_length=20)


class VacancyCreate(VacancyBase):
    pass


class VacancyUpdate(VacancyBase):
    pass


class VacancyOut(VacancyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class CandidateBase(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    vacancy_id: int
    resume_text: str = Field(min_length=20)
    skills: List[str]
    experience_years: float = Field(ge=0, le=50)
    status: str = Field(default="new")


class CandidateCreate(CandidateBase):
    pass


class CandidateUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    vacancy_id: Optional[int] = None
    resume_text: Optional[str] = None
    skills: Optional[List[str]] = None
    experience_years: Optional[float] = Field(default=None, ge=0, le=50)
    status: Optional[str] = None


class CandidateOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    vacancy_id: int
    vacancy_title: str
    resume_text: str
    skills: List[str]
    experience_years: float
    ai_score: Optional[float]
    status: str
    applied_date: date


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    department: str
    position: str
    hire_date: date
    status: str
    salary: float
    is_remote: bool
    fired_date: Optional[date]


class OnboardingTaskBase(BaseModel):
    title: str
    description: str
    due_date: date
    is_completed: bool = False
    category: str


class OnboardingTaskCreate(OnboardingTaskBase):
    pass


class OnboardingTaskUpdate(BaseModel):
    id: int
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[date] = None
    is_completed: Optional[bool] = None
    category: Optional[str] = None


class OnboardingTaskOut(OnboardingTaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_id: int


class TrainingOut(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    course_name: str
    status: str
    start_date: date
    end_date: Optional[date]


class ContractBase(BaseModel):
    contractor_name: str
    contract_number: str
    month: str
    hours_worked: float = Field(gt=0)
    hourly_rate: float = Field(gt=0)
    status: str
    jira_tasks: List[str]


class ContractCreate(ContractBase):
    pass


class ContractOut(BaseModel):
    id: int
    contractor_name: str
    contract_number: str
    month: str
    hours_worked: float
    hourly_rate: float
    total_amount: float
    status: str
    jira_tasks: List[str]


class AiSummarizeRequest(BaseModel):
    candidate_id: int


class AiCompareRequest(BaseModel):
    candidate_ids: List[int] = Field(min_length=2)
    criteria: str = Field(min_length=2)


class AiCustomQueryRequest(BaseModel):
    candidate_ids: List[int] = Field(min_length=1)
    hr_prompt: str = Field(min_length=2)


app = FastAPI(title="HR Command Center API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

churn_model: Optional[ChurnModelBundle] = None
security = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    try:
        payload = verify_token(credentials.credentials)
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = db.query(HRUser).filter(HRUser.id == int(user_id)).first()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def _serialize_candidate(candidate: Candidate) -> CandidateOut:
    return CandidateOut(
        id=candidate.id,
        name=candidate.name,
        email=candidate.email,
        vacancy_id=candidate.vacancy_id,
        vacancy_title=candidate.vacancy.title if candidate.vacancy else "Неизвестно",
        resume_text=candidate.resume_text,
        skills=json.loads(candidate.skills_json),
        experience_years=candidate.experience_years,
        ai_score=candidate.ai_score,
        status=candidate.status,
        applied_date=candidate.applied_date,
    )


def _calculate_turnover_rate(db: Session) -> float:
    total = db.query(Employee).count()
    if total == 0:
        return 0.0
    fired = db.query(Employee).filter(Employee.status == "fired").count()
    return round((fired / total) * 100, 2)


def _avg_engagement_map(db: Session) -> Dict[int, float]:
    rows = (
        db.query(EngagementSurvey.employee_id, func.avg(EngagementSurvey.score_1_to_10))
        .group_by(EngagementSurvey.employee_id)
        .all()
    )
    return {employee_id: float(avg_score) for employee_id, avg_score in rows}


def _build_candidate_score_text(resume_text: str, skills: List[str]) -> str:
    return f"{resume_text} {' '.join(skills)}"


def _candidate_skills(candidate: Candidate) -> List[str]:
    try:
        return json.loads(candidate.skills_json)
    except json.JSONDecodeError:
        return []


def _build_candidate_llm_block(candidate: Candidate) -> str:
    skills = _candidate_skills(candidate)
    vacancy_title = candidate.vacancy.title if candidate.vacancy else "Неизвестная вакансия"
    return (
        f"Кандидат: {candidate.name}\n"
        f"Позиция: {vacancy_title}\n"
        f"Резюме: {candidate.resume_text}\n"
        f"Навыки: {', '.join(skills)}\n"
        f"Опыт: {candidate.experience_years} лет\n"
    )


def _month_window(month_start: date) -> tuple[date, date]:
    if month_start.month == 12:
        next_month = date(month_start.year + 1, 1, 1)
    else:
        next_month = date(month_start.year, month_start.month + 1, 1)
    month_end = next_month - timedelta(days=1)
    return month_start, month_end


def _shift_month(month_start: date, delta_months: int) -> date:
    year = month_start.year
    month = month_start.month + delta_months
    while month <= 0:
        month += 12
        year -= 1
    while month > 12:
        month -= 12
        year += 1
    return date(year, month, 1)


def _format_month_label(month_start: date) -> str:
    return f"{RUS_MONTH_SHORT[month_start.month]} {month_start.year}"


def _seed_data(db: Session) -> None:
    if db.query(HRUser).count() == 0:
        admin = HRUser(username="admin", email="admin@company.ru", full_name="Администратор", hashed_password=hash_password("admin"))
        db.add(admin)
        db.commit()

    if db.query(Employee).count() > 0:
        return

    today = date.today()

    employee_payload = [
        ("Иван Петров", "ivan.petrov@company.ru", "Development", "Backend разработчик", "active", 230000, True, 36),
        ("Мария Смирнова", "maria.smirnova@company.ru", "Marketing", "Маркетолог", "active", 180000, False, 28),
        ("Алексей Волков", "alexey.volkov@company.ru", "Sales", "Менеджер по продажам", "active", 170000, False, 24),
        ("Екатерина Орлова", "ekaterina.orlova@company.ru", "HR", "HR BP", "active", 190000, True, 30),
        ("Дмитрий Кузнецов", "dmitry.kuznetsov@company.ru", "Finance", "Финансовый аналитик", "active", 210000, False, 32),
        ("Анна Лебедева", "anna.lebedeva@company.ru", "Development", "Frontend разработчик", "active", 220000, True, 26),
        ("Павел Михайлов", "pavel.mikhailov@company.ru", "Marketing", "Контент-менеджер", "active", 160000, True, 22),
        ("Ольга Соколова", "olga.sokolova@company.ru", "Sales", "Account Executive", "active", 200000, False, 20),
        ("Сергей Никитин", "sergey.nikitin@company.ru", "HR", "Рекрутер", "active", 150000, False, 18),
        ("Наталья Федорова", "natalia.fedorova@company.ru", "Finance", "Бухгалтер", "active", 155000, False, 40),
        ("Илья Морозов", "ilya.morozov@company.ru", "Development", "Data Engineer", "active", 250000, True, 42),
        ("Виктория Белова", "victoria.belova@company.ru", "Marketing", "SMM менеджер", "active", 145000, True, 14),
        ("Роман Егоров", "roman.egorov@company.ru", "Sales", "Руководитель продаж", "active", 280000, False, 48),
        ("Ксения Павлова", "ksenia.pavlova@company.ru", "HR", "Специалист по адаптации", "active", 140000, True, 16),
        ("Артем Захаров", "artem.zakharov@company.ru", "Finance", "Контролер", "active", 165000, False, 27),
        ("Людмила Комарова", "lyudmila.komarova@company.ru", "Development", "QA инженер", "active", 195000, True, 19),
        ("Григорий Денисов", "grigory.denisov@company.ru", "Sales", "Менеджер по работе с клиентами", "active", 175000, True, 13),
        ("Вероника Макарова", "veronika.makarova@company.ru", "HR", "HR Generalist", "onboarding", 120000, True, 2),
        ("Тимур Белов", "timur.belov@company.ru", "Development", "Junior Python разработчик", "onboarding", 110000, False, 1),
        ("Елена Гусева", "elena.guseva@company.ru", "Marketing", "Ассистент маркетолога", "onboarding", 105000, False, 1),
        ("Максим Титов", "maxim.titov@company.ru", "Sales", "Стажер по продажам", "fired", 90000, False, 8),
        ("Юлия Архипова", "yulia.arkhipova@company.ru", "Development", "Стажер QA", "fired", 85000, True, 6),
        ("Степан Андреев", "stepan.andreev@company.ru", "Finance", "Младший бухгалтер", "fired", 95000, False, 7),
        ("Дарья Тихонова", "daria.tikhonova@company.ru", "Marketing", "Junior SMM", "fired", 88000, True, 5),
        ("Николай Серов", "nikolay.serov@company.ru", "HR", "Помощник рекрутера", "fired", 87000, False, 4),
    ]

    employees: List[Employee] = []
    for name, email, department, position, status, salary, is_remote, tenure_months in employee_payload:
        hire_dt = today - timedelta(days=tenure_months * 30)
        fired_dt = hire_dt + timedelta(days=max(35, tenure_months * 20)) if status == "fired" else None

        employee = Employee(
            name=name,
            email=email,
            department=department,
            position=position,
            hire_date=hire_dt,
            status=status,
            salary=salary,
            is_remote=is_remote,
            fired_date=fired_dt,
        )
        employees.append(employee)
        db.add(employee)

    db.flush()

    vacancies = [
        Vacancy(
            title="Senior Python разработчик",
            department="Development",
            required_skills_text="Python FastAPI SQLAlchemy PostgreSQL Docker CI/CD",
            description="Ищем опытного инженера для развития внутренних HR-продуктов, проектирования API и оптимизации производительности backend-сервисов.",
        ),
        Vacancy(
            title="Performance Marketing Manager",
            department="Marketing",
            required_skills_text="Google Ads Яндекс.Директ аналитика A/B тесты GA4",
            description="Нужен специалист для запуска performance-кампаний, построения сквозной аналитики и повышения ROMI по ключевым каналам.",
        ),
        Vacancy(
            title="Менеджер B2B продаж",
            department="Sales",
            required_skills_text="переговоры CRM воронка продаж холодные звонки презентации",
            description="Роль включает развитие клиентского портфеля, проведение переговоров с ЛПР и достижение квартального плана продаж.",
        ),
        Vacancy(
            title="HR аналитик",
            department="HR",
            required_skills_text="Excel SQL HR-метрики Power BI адаптация персонала",
            description="Ожидаем опыт построения HR-дашбордов, анализа текучести и рекомендаций по удержанию сотрудников.",
        ),
        Vacancy(
            title="Финансовый менеджер",
            department="Finance",
            required_skills_text="бюджетирование финансовое моделирование Excel 1С управленческий учет",
            description="Задачи: планирование бюджета, контроль затрат подразделений и подготовка управленческой отчетности для руководства.",
        ),
    ]

    for vacancy in vacancies:
        db.add(vacancy)

    db.flush()

    candidate_payload = [
        ("Владислав Осипов", "vladislav.osipov@mail.ru", vacancies[0].id, "Работал backend-разработчиком 4 года. Проектировал API на FastAPI и внедрял асинхронные очереди. Активно участвовал в код-ревью.", ["Python", "FastAPI", "SQLAlchemy", "Docker"], 4.5, "screening"),
        ("Ирина Сафронова", "irina.safronova@mail.ru", vacancies[0].id, "Разрабатывала сервисы на Python и Flask. Вела миграции БД и писала автотесты. Умею оптимизировать SQL-запросы.", ["Python", "Flask", "SQL", "Pytest"], 3.0, "new"),
        ("Олег Панин", "oleg.panin@mail.ru", vacancies[1].id, "Запускал рекламные кампании в Google Ads и Директ. Настраивал сквозную аналитику и отчеты по CAC. Повышал конверсию лендингов.", ["Google Ads", "GA4", "A/B тесты", "Яндекс.Директ"], 5.0, "interview"),
        ("Светлана Киселева", "svetlana.kiseleva@mail.ru", vacancies[1].id, "Вела performance-маркетинг в e-commerce. Управляла бюджетами и готовила гипотезы для роста ROMI. Хорошо знаю веб-аналитику.", ["performance", "аналитика", "ROMI", "контекст"], 4.0, "screening"),
        ("Евгений Руденко", "evgeny.rudenko@mail.ru", vacancies[2].id, "8 лет в корпоративных продажах. Закрывал сделки с крупными клиентами и выстраивал долгосрочные отношения. Регулярно выполнял план на 120%.", ["CRM", "переговоры", "B2B", "презентации"], 8.0, "offer"),
        ("Полина Жукова", "polina.zhukova@mail.ru", vacancies[2].id, "Работала менеджером по развитию клиентов. Вела воронку продаж и проводила демо продукта. Умею работать с возражениями.", ["воронка", "продажи", "клиенты", "презентации"], 3.5, "interview"),
        ("Аркадий Мельников", "arkady.melnikov@mail.ru", vacancies[3].id, "Строил HR-отчеты в Power BI и Excel. Анализировал текучесть персонала и вовлеченность сотрудников. Подготавливал рекомендации для HRD.", ["HR-метрики", "Power BI", "Excel", "SQL"], 4.0, "screening"),
        ("Алина Воронцова", "alina.vorontsova@mail.ru", vacancies[3].id, "Занималась аналитикой процессов адаптации и обучения. Автоматизировала сводные отчеты в Excel. Имею опыт визуализации данных.", ["адаптация", "аналитика", "Excel", "дашборды"], 2.5, "new"),
        ("Михаил Котов", "mihail.kotov@mail.ru", vacancies[4].id, "Работал финансовым менеджером в IT-компании. Формировал бюджеты проектов и контролировал факт/план. Сопровождал управленческую отчетность.", ["бюджетирование", "финансы", "Excel", "1С"], 6.0, "interview"),
        ("Кристина Романова", "kristina.romanova@mail.ru", vacancies[4].id, "Вела учет затрат и готовила финансовые модели. Участвовала в квартальном планировании. Работала с кросс-функциональными командами.", ["финансовое моделирование", "учет", "планирование", "1С"], 4.0, "screening"),
        ("Никита Королев", "nikita.korolev@mail.ru", vacancies[0].id, "Разрабатывал микросервисы и интеграции. Настраивал CI/CD и покрывал код тестами. Участвовал в релизах highload-систем.", ["Python", "CI/CD", "микросервисы", "Docker"], 5.5, "new"),
        ("Яна Костина", "yana.kostina@mail.ru", vacancies[1].id, "Работала с digital-кампаниями и контент-стратегией. Тестировала креативы и аудитории. Отвечала за рост лидогенерации.", ["креативы", "лидогенерация", "аналитика", "A/B тесты"], 3.0, "new"),
        ("Петр Тарасов", "petr.tarasov@mail.ru", vacancies[2].id, "Вел продажи SaaS-продукта в сегменте B2B. Эффективно работал с холодными контактами. Поддерживал CRM в актуальном состоянии.", ["SaaS", "B2B", "CRM", "холодные звонки"], 2.8, "screening"),
        ("Жанна Ермакова", "zhanna.ermakova@mail.ru", vacancies[3].id, "Готовила HR-аналитику для руководителей подразделений. Внедряла регулярные опросы вовлеченности. Проводила презентации результатов.", ["опросы", "HR", "аналитика", "презентации"], 3.7, "interview"),
        ("Константин Лапшин", "konstantin.lapshin@mail.ru", vacancies[4].id, "Специализируюсь на управленческом учете и бюджетном контроле. Оптимизировал финансовые процессы в компании. Уверенно работаю в Excel и 1С.", ["управленческий учет", "Excel", "1С", "бюджет"], 7.0, "offer"),
    ]

    for name, email, vacancy_id, resume, skills, exp_years, status in candidate_payload:
        vacancy = db.query(Vacancy).filter(Vacancy.id == vacancy_id).first()
        if not vacancy:
            continue
        candidate_text = _build_candidate_score_text(resume, skills)
        vacancy_text = f"{vacancy.required_skills_text} {vacancy.description}"
        ai_score = score_candidate(candidate_text, vacancy_text)

        candidate = Candidate(
            name=name,
            email=email,
            vacancy_id=vacancy_id,
            resume_text=resume,
            skills_json=json.dumps(skills, ensure_ascii=False),
            experience_years=exp_years,
            ai_score=ai_score,
            status=status,
            applied_date=today - timedelta(days=random.randint(1, 35)),
        )
        db.add(candidate)

    db.flush()

    onboarding_titles = [
        ("documents", "Подписать NDA", "Подписание соглашения о неразглашении и кадровых документов."),
        ("access", "Получить доступы", "Настроить доступ в Jira, Slack, корпоративную почту и VPN."),
        ("training", "Пройти вводный курс", "Ознакомиться с внутренними процессами и стандартами разработки."),
        ("intro", "Встреча с командой", "Провести знакомство с командой и руководителем направления."),
    ]

    onboarding_employees = [employee for employee in employees if employee.status == "onboarding"]
    for employee in onboarding_employees:
        for idx, (category, title, description) in enumerate(onboarding_titles):
            task = OnboardingTask(
                employee_id=employee.id,
                title=title,
                description=description,
                due_date=today + timedelta(days=(idx + 1) * 3),
                is_completed=idx == 0,
                category=category,
            )
            db.add(task)

    comments_positive = [
        "Нравится атмосфера в команде и прозрачность целей.",
        "Есть поддержка руководителя и понятные приоритеты.",
        "Чувствую, что мой вклад заметен и ценен.",
    ]
    comments_negative = [
        "Высокая нагрузка, не хватает обратной связи.",
        "Не хватает ясности в задачах и ожиданиях.",
        "Сложно совмещать задачи из-за частых изменений приоритетов.",
    ]

    for month_delta in range(6):
        survey_date = (today.replace(day=1) - timedelta(days=month_delta * 30)).replace(day=5)
        for employee in employees:
            if employee.status == "fired":
                score = random.randint(2, 4)
                comment = random.choice(comments_negative)
            elif employee.status == "onboarding":
                score = random.randint(6, 8)
                comment = "Прохожу адаптацию, команда помогает быстро войти в контекст."
            else:
                score = random.randint(5, 9)
                comment = random.choice(comments_positive)

            survey = EngagementSurvey(
                employee_id=employee.id,
                date=survey_date,
                score_1_to_10=score,
                comment=comment,
            )
            db.add(survey)

    training_payload = [
        (employees[0].id, "Продвинутый FastAPI", "completed", today - timedelta(days=120), today - timedelta(days=90)),
        (employees[1].id, "Сквозная веб-аналитика", "completed", today - timedelta(days=100), today - timedelta(days=70)),
        (employees[2].id, "Техники B2B переговоров", "in_progress", today - timedelta(days=20), None),
        (employees[3].id, "People Analytics", "planned", today + timedelta(days=10), None),
        (employees[4].id, "Финансовое моделирование", "completed", today - timedelta(days=80), today - timedelta(days=55)),
        (employees[5].id, "React для frontend", "in_progress", today - timedelta(days=12), None),
        (employees[6].id, "Контент-маркетинг в B2B", "planned", today + timedelta(days=15), None),
        (employees[7].id, "Работа с ключевыми клиентами", "completed", today - timedelta(days=75), today - timedelta(days=50)),
        (employees[8].id, "Интервью по компетенциям", "in_progress", today - timedelta(days=18), None),
        (employees[9].id, "Автоматизация отчетности в Excel", "planned", today + timedelta(days=20), None),
    ]

    for employee_id, course, status, start_dt, end_dt in training_payload:
        record = TrainingRecord(
            employee_id=employee_id,
            course_name=course,
            status=status,
            start_date=start_dt,
            end_date=end_dt,
        )
        db.add(record)

    contract_payload = [
        ("ООО ТехАутсорс", "GPH-2026-001", "2026-01", 120, 2500, "signed", ["HR-112", "HR-118", "HR-121"]),
        ("ИП Сидоров А.А.", "GPH-2026-002", "2026-01", 96, 2300, "approved", ["HR-125", "HR-127"]),
        ("ООО ДатаЭксперт", "GPH-2026-003", "2026-02", 140, 2800, "draft", ["HR-133", "HR-137", "HR-140"]),
        ("ИП Мельник И.В.", "GPH-2026-004", "2026-02", 88, 2100, "signed", ["HR-142", "HR-144"]),
        ("ООО КонтентЛаб", "GPH-2026-005", "2026-03", 110, 2400, "approved", ["HR-149", "HR-151", "HR-153"]),
    ]

    for contractor_name, contract_number, month, hours_worked, hourly_rate, status, jira_tasks in contract_payload:
        contract = ContractGPH(
            contractor_name=contractor_name,
            contract_number=contract_number,
            month=month,
            hours_worked=hours_worked,
            hourly_rate=hourly_rate,
            total_amount=round(hours_worked * hourly_rate, 2),
            status=status,
            jira_tasks_json=json.dumps(jira_tasks, ensure_ascii=False),
        )
        db.add(contract)

    db.commit()


def _train_model_on_startup() -> None:
    global churn_model
    db = SessionLocal()
    try:
        employees = db.query(Employee).all()
        surveys = db.query(EngagementSurvey).all()
        churn_model = train_churn_model(employees, surveys)
    finally:
        db.close()


@app.on_event("startup")
def startup_event() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _seed_data(db)
    finally:
        db.close()
    _train_model_on_startup()


@app.post("/api/auth/login")
def auth_login(payload: AuthLoginRequest, db: Session = Depends(get_db)):
    user = db.query(HRUser).filter(HRUser.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    token = create_access_token({"sub": str(user.id), "username": user.username})
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "username": user.username, "full_name": user.full_name}}


@app.post("/api/auth/register")
def auth_register(payload: AuthRegisterRequest, db: Session = Depends(get_db)):
    if db.query(HRUser).filter(HRUser.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")
    if db.query(HRUser).filter(HRUser.email == str(payload.email)).first():
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
    user = HRUser(username=payload.username, email=str(payload.email), full_name=payload.full_name, hashed_password=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id), "username": user.username})
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "username": user.username, "full_name": user.full_name}}


@app.get("/api/auth/me")
def auth_me(current_user: HRUser = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username, "full_name": current_user.full_name, "email": current_user.email}


@app.get("/api/vacancies", response_model=List[VacancyOut])
def list_vacancies(db: Session = Depends(get_db)):
    return db.query(Vacancy).order_by(Vacancy.id.asc()).all()


@app.post("/api/vacancies", response_model=VacancyOut)
def create_vacancy(payload: VacancyCreate, db: Session = Depends(get_db)):
    vacancy = Vacancy(**payload.model_dump())
    db.add(vacancy)
    db.commit()
    db.refresh(vacancy)
    return vacancy


@app.put("/api/vacancies/{vacancy_id}", response_model=VacancyOut)
def update_vacancy(vacancy_id: int, payload: VacancyUpdate, db: Session = Depends(get_db)):
    vacancy = db.query(Vacancy).filter(Vacancy.id == vacancy_id).first()
    if not vacancy:
        raise HTTPException(status_code=404, detail="Вакансия не найдена")

    for key, value in payload.model_dump().items():
        setattr(vacancy, key, value)

    db.commit()
    db.refresh(vacancy)
    return vacancy


@app.get("/api/candidates", response_model=List[CandidateOut])
def list_candidates(db: Session = Depends(get_db)):
    candidates = db.query(Candidate).order_by(Candidate.id.asc()).all()
    return [_serialize_candidate(candidate) for candidate in candidates]


@app.post("/api/candidates", response_model=CandidateOut)
def create_candidate(payload: CandidateCreate, db: Session = Depends(get_db)):
    if payload.status not in CANDIDATE_STATUSES:
        raise HTTPException(status_code=400, detail="Некорректный статус кандидата")

    vacancy = db.query(Vacancy).filter(Vacancy.id == payload.vacancy_id).first()
    if not vacancy:
        raise HTTPException(status_code=404, detail="Вакансия не найдена")

    candidate_text = _build_candidate_score_text(payload.resume_text, payload.skills)
    vacancy_text = f"{vacancy.required_skills_text} {vacancy.description}"
    ai_score = score_candidate(candidate_text, vacancy_text)

    candidate = Candidate(
        name=payload.name,
        email=str(payload.email),
        vacancy_id=payload.vacancy_id,
        resume_text=payload.resume_text,
        skills_json=json.dumps(payload.skills, ensure_ascii=False),
        experience_years=payload.experience_years,
        ai_score=ai_score,
        status=payload.status,
        applied_date=date.today(),
    )

    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return _serialize_candidate(candidate)


@app.put("/api/candidates/{candidate_id}", response_model=CandidateOut)
def update_candidate(candidate_id: int, payload: CandidateUpdate, db: Session = Depends(get_db)):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Кандидат не найден")

    updates = payload.model_dump(exclude_none=True)

    if "status" in updates and updates["status"] not in CANDIDATE_STATUSES:
        raise HTTPException(status_code=400, detail="Некорректный статус кандидата")

    if "vacancy_id" in updates:
        vacancy = db.query(Vacancy).filter(Vacancy.id == updates["vacancy_id"]).first()
        if not vacancy:
            raise HTTPException(status_code=404, detail="Вакансия не найдена")

    if "skills" in updates:
        updates["skills_json"] = json.dumps(updates.pop("skills"), ensure_ascii=False)

    for key, value in updates.items():
        if key in {"skills_json", "name", "email", "vacancy_id", "resume_text", "experience_years", "status"}:
            setattr(candidate, key, value)

    if any(field in updates for field in {"resume_text", "skills_json", "vacancy_id"}):
        vacancy = db.query(Vacancy).filter(Vacancy.id == candidate.vacancy_id).first()
        skills = json.loads(candidate.skills_json)
        candidate_text = _build_candidate_score_text(candidate.resume_text, skills)
        vacancy_text = f"{vacancy.required_skills_text} {vacancy.description}" if vacancy else ""
        candidate.ai_score = score_candidate(candidate_text, vacancy_text)

    db.commit()
    db.refresh(candidate)
    return _serialize_candidate(candidate)


@app.get("/api/candidates/{candidate_id}/rescore", response_model=CandidateOut)
def rescore_candidate(candidate_id: int, db: Session = Depends(get_db)):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Кандидат не найден")

    vacancy = db.query(Vacancy).filter(Vacancy.id == candidate.vacancy_id).first()
    if not vacancy:
        raise HTTPException(status_code=404, detail="Вакансия не найдена")

    skills = json.loads(candidate.skills_json)
    candidate_text = _build_candidate_score_text(candidate.resume_text, skills)
    vacancy_text = f"{vacancy.required_skills_text} {vacancy.description}"
    candidate.ai_score = score_candidate(candidate_text, vacancy_text)

    db.commit()
    db.refresh(candidate)
    return _serialize_candidate(candidate)


COMMON_SKILLS = ["python", "java", "javascript", "typescript", "react", "angular", "vue", "node", "fastapi", "flask", "django", "sql", "postgresql", "mysql", "mongodb", "redis", "docker", "kubernetes", "aws", "azure", "gcp", "git", "ci/cd", "linux", "html", "css", "tailwind", "rest", "graphql", "microservices", "agile", "scrum", "jira", "figma", "photoshop", "excel", "power bi", "tableau", "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", "nlp", "cv", "1c", "sap", "crm", "b2b", "b2c"]


def _extract_skills_from_text(text: str) -> List[str]:
    lower = text.lower()
    return [skill for skill in COMMON_SKILLS if skill in lower]


@app.post("/api/candidates/upload-resume", response_model=CandidateOut)
def upload_resume(file: UploadFile = File(...), vacancy_id: int = Form(...), candidate_name: str = Form(...), candidate_email: str = Form(...), experience_years: float = Form(...), db: Session = Depends(get_db)):
    vacancy = db.query(Vacancy).filter(Vacancy.id == vacancy_id).first()
    if not vacancy:
        raise HTTPException(status_code=404, detail="Вакансия не найдена")
    try:
        pdf_reader = PdfReader(BytesIO(file.file.read()))
        resume_text = " ".join(page.extract_text() or "" for page in pdf_reader.pages).strip()
    except Exception:
        raise HTTPException(status_code=400, detail="Не удалось прочитать PDF файл")
    if not resume_text:
        resume_text = "Текст резюме не извлечён"
    skills = _extract_skills_from_text(resume_text)
    if not skills:
        skills = ["general"]
    candidate_text = _build_candidate_score_text(resume_text, skills)
    vacancy_text = f"{vacancy.required_skills_text} {vacancy.description}"
    ai_score = score_candidate(candidate_text, vacancy_text)
    candidate = Candidate(name=candidate_name, email=candidate_email, vacancy_id=vacancy_id, resume_text=resume_text, skills_json=json.dumps(skills, ensure_ascii=False), experience_years=experience_years, ai_score=ai_score, status="new", applied_date=date.today())
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return _serialize_candidate(candidate)


@app.get("/api/employees", response_model=List[EmployeeOut])
def list_employees(
    department: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(Employee)

    if department:
        query = query.filter(Employee.department == department)
    if status:
        if status not in EMPLOYEE_STATUSES:
            raise HTTPException(status_code=400, detail="Некорректный статус сотрудника")
        query = query.filter(Employee.status == status)

    return query.order_by(Employee.id.asc()).all()


@app.get("/api/analytics")
def get_analytics(db: Session = Depends(get_db)):
    total_employees = db.query(Employee).count()
    onboarding_count = db.query(Employee).filter(Employee.status == "onboarding").count()

    avg_engagement = db.query(func.avg(EngagementSurvey.score_1_to_10)).scalar() or 0
    turnover_rate = _calculate_turnover_rate(db)

    workload_rows = db.query(Employee.department, func.count(Employee.id)).group_by(Employee.department).all()
    workload_by_department = [{"department": dep, "count": count} for dep, count in workload_rows]

    engagement_by_department_rows = (
        db.query(Employee.department, func.avg(EngagementSurvey.score_1_to_10))
        .join(EngagementSurvey, EngagementSurvey.employee_id == Employee.id)
        .group_by(Employee.department)
        .all()
    )
    engagement_by_department = [
        {"department": dep, "avg_engagement": round(float(avg_score), 2)}
        for dep, avg_score in engagement_by_department_rows
    ]

    dept_distribution_map = defaultdict(int)
    remote_count = 0
    for employee in db.query(Employee).all():
        dept_distribution_map[employee.department] += 1
        if employee.is_remote:
            remote_count += 1

    department_distribution = [
        {"department": dep, "count": count} for dep, count in sorted(dept_distribution_map.items())
    ]

    remote_percentage = round((remote_count / total_employees) * 100, 2) if total_employees else 0

    return {
        "total_employees": total_employees,
        "onboarding_count": onboarding_count,
        "average_engagement": round(float(avg_engagement), 2),
        "turnover_rate": turnover_rate,
        "workload_by_department": workload_by_department,
        "engagement_by_department": engagement_by_department,
        "department_distribution": department_distribution,
        "remote_percentage": remote_percentage,
    }


@app.get("/api/analytics/turnover-history")
def get_turnover_history(db: Session = Depends(get_db)):
    today = date.today()
    current_month = date(today.year, today.month, 1)
    months = [_shift_month(current_month, -shift) for shift in range(5, -1, -1)]

    history = []

    for month_start in months:
        start, end = _month_window(month_start)

        fired_in_month = (
            db.query(Employee)
            .filter(Employee.fired_date.isnot(None), Employee.fired_date >= start, Employee.fired_date <= end)
            .count()
        )

        employees_at_time = (
            db.query(Employee)
            .filter(
                Employee.hire_date <= end,
                or_(Employee.fired_date.is_(None), Employee.fired_date > end),
            )
            .count()
        )

        turnover = round((fired_in_month / employees_at_time) * 100, 1) if employees_at_time > 0 else 0.0
        history.append({"month": _format_month_label(month_start), "turnover": turnover})

    return history


@app.get("/api/analytics/churn-risk")
def get_churn_risk(db: Session = Depends(get_db)):
    if churn_model is None:
        raise HTTPException(status_code=503, detail="Модель оттока пока не обучена")

    avg_map = _avg_engagement_map(db)
    today = date.today()

    active_employees = db.query(Employee).filter(Employee.status == "active").all()
    result = []

    for employee in active_employees:
        tenure_months = max(0, (today.year - employee.hire_date.year) * 12 + (today.month - employee.hire_date.month))
        avg_engagement = avg_map.get(employee.id, churn_model.fallback_engagement)
        churn_probability = predict_churn(
            churn_model,
            {
                "tenure_months": tenure_months,
                "avg_engagement": avg_engagement,
                "is_remote": employee.is_remote,
                "salary": employee.salary,
                "department": employee.department,
            },
        )
        result.append(
            {
                "employee_id": employee.id,
                "name": employee.name,
                "department": employee.department,
                "avg_engagement": round(avg_engagement, 2),
                "tenure_months": tenure_months,
                "is_remote": employee.is_remote,
                "salary": employee.salary,
                "churn_probability": round(churn_probability, 4),
            }
        )

    result.sort(key=lambda item: item["churn_probability"], reverse=True)
    return result


@app.get("/api/alerts")
def get_alerts(db: Session = Depends(get_db)):
    today = date.today()

    waiting_candidates_raw = (
        db.query(Candidate)
        .join(Vacancy, Vacancy.id == Candidate.vacancy_id)
        .filter(Candidate.status == "new", Candidate.applied_date <= (today - timedelta(days=7)))
        .order_by(Candidate.applied_date.asc())
        .all()
    )
    candidates_waiting = [
        {
            "id": candidate.id,
            "name": candidate.name,
            "vacancy_title": candidate.vacancy.title if candidate.vacancy else "Неизвестно",
            "days_waiting": (today - candidate.applied_date).days,
        }
        for candidate in waiting_candidates_raw
    ]

    high_churn_risk = []
    if churn_model is not None:
        avg_map = _avg_engagement_map(db)
        active_employees = db.query(Employee).filter(Employee.status == "active").all()

        for employee in active_employees:
            tenure_months = max(
                0,
                (today.year - employee.hire_date.year) * 12 + (today.month - employee.hire_date.month),
            )
            avg_engagement = avg_map.get(employee.id, churn_model.fallback_engagement)
            churn_probability = predict_churn(
                churn_model,
                {
                    "tenure_months": tenure_months,
                    "avg_engagement": avg_engagement,
                    "is_remote": employee.is_remote,
                    "salary": employee.salary,
                    "department": employee.department,
                },
            )

            if churn_probability > 0.7:
                high_churn_risk.append(
                    {
                        "id": employee.id,
                        "name": employee.name,
                        "department": employee.department,
                        "churn_probability": round(churn_probability, 4),
                    }
                )

        high_churn_risk.sort(key=lambda item: item["churn_probability"], reverse=True)

    overdue_tasks_raw = (
        db.query(OnboardingTask)
        .join(Employee, Employee.id == OnboardingTask.employee_id)
        .filter(and_(OnboardingTask.due_date < today, OnboardingTask.is_completed.is_(False)))
        .order_by(OnboardingTask.due_date.asc())
        .all()
    )
    overdue_onboarding = [
        {
            "id": task.id,
            "title": task.title,
            "employee_name": task.employee.name if task.employee else "Неизвестно",
            "due_date": task.due_date,
        }
        for task in overdue_tasks_raw
    ]

    return {
        "candidates_waiting": candidates_waiting,
        "high_churn_risk": high_churn_risk,
        "overdue_onboarding": overdue_onboarding,
    }


@app.get("/api/ai/health")
async def ai_health():
    transport = httpx.AsyncHTTPTransport(proxy=None)
    try:
        async with httpx.AsyncClient(timeout=10.0, transport=transport) as client:
            response = await client.get(f"{LLM_BASE_URL}/health")
            response.raise_for_status()
            return response.json()
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError):
        return {"status": "unavailable"}


@app.post("/api/ai/summarize")
async def ai_summarize(payload: AiSummarizeRequest, db: Session = Depends(get_db)):
    candidate = db.query(Candidate).filter(Candidate.id == payload.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Кандидат не найден")

    vacancy = db.query(Vacancy).filter(Vacancy.id == candidate.vacancy_id).first()
    if not vacancy:
        raise HTTPException(status_code=404, detail="Вакансия не найдена")

    skills = _candidate_skills(candidate)
    prompt = (
        f"Проанализируй резюме кандидата на позицию {vacancy.title}.\n\n"
        f"Резюме: {candidate.resume_text}\n"
        f"Навыки: {', '.join(skills)}\n"
        f"Опыт: {candidate.experience_years} лет\n\n"
        "Выдели: 1) ключевые навыки 2) сильные стороны 3) слабые стороны 4) общая рекомендация"
    )

    response_text = await send_to_llm(prompt)
    return {"summary": response_text}


@app.post("/api/ai/compare")
async def ai_compare(payload: AiCompareRequest, db: Session = Depends(get_db)):
    candidates = db.query(Candidate).filter(Candidate.id.in_(payload.candidate_ids)).order_by(Candidate.id.asc()).all()
    if len(candidates) != len(set(payload.candidate_ids)):
        raise HTTPException(status_code=404, detail="Один или несколько кандидатов не найдены")

    candidate_blocks = "\n\n".join(_build_candidate_llm_block(candidate) for candidate in candidates)
    prompt = (
        "Список кандидатов для анализа:\n\n"
        f"{candidate_blocks}\n\n"
        f"Сравни кандидатов по критерию: {payload.criteria}. Составь рейтинг и объясни выбор."
    )

    response_text = await send_to_llm(prompt)
    return {"analysis": response_text}


@app.post("/api/ai/custom-query")
async def ai_custom_query(payload: AiCustomQueryRequest, db: Session = Depends(get_db)):
    unique_ids = list(dict.fromkeys(payload.candidate_ids))
    candidates = db.query(Candidate).filter(Candidate.id.in_(unique_ids)).order_by(Candidate.id.asc()).all()
    if len(candidates) != len(unique_ids):
        raise HTTPException(status_code=404, detail="Один или несколько кандидатов не найдены")

    candidate_blocks = "\n\n".join(_build_candidate_llm_block(candidate) for candidate in candidates)
    prompt = f"{payload.hr_prompt}\n\nДанные кандидатов:\n\n{candidate_blocks}"

    response_text = await send_to_llm(prompt)
    return {"answer": response_text}


@app.get("/api/onboarding/{employee_id}/tasks", response_model=List[OnboardingTaskOut])
def list_onboarding_tasks(employee_id: int, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    return (
        db.query(OnboardingTask)
        .filter(OnboardingTask.employee_id == employee_id)
        .order_by(OnboardingTask.category.asc(), OnboardingTask.id.asc())
        .all()
    )


@app.post("/api/onboarding/{employee_id}/tasks", response_model=OnboardingTaskOut)
def create_onboarding_task(employee_id: int, payload: OnboardingTaskCreate, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    if payload.category not in ONBOARDING_CATEGORIES:
        raise HTTPException(status_code=400, detail="Некорректная категория задачи")

    task = OnboardingTask(employee_id=employee_id, **payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.put("/api/onboarding/{employee_id}/tasks", response_model=OnboardingTaskOut)
def update_onboarding_task(employee_id: int, payload: OnboardingTaskUpdate, db: Session = Depends(get_db)):
    task = (
        db.query(OnboardingTask)
        .filter(OnboardingTask.employee_id == employee_id, OnboardingTask.id == payload.id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    updates = payload.model_dump(exclude_none=True)
    updates.pop("id", None)

    if "category" in updates and updates["category"] not in ONBOARDING_CATEGORIES:
        raise HTTPException(status_code=400, detail="Некорректная категория задачи")

    for key, value in updates.items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)
    return task


@app.get("/api/training", response_model=List[TrainingOut])
def list_training(status: Optional[str] = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(TrainingRecord).join(Employee, Employee.id == TrainingRecord.employee_id)

    if status:
        if status not in TRAINING_STATUSES:
            raise HTTPException(status_code=400, detail="Некорректный статус обучения")
        query = query.filter(TrainingRecord.status == status)

    rows = query.order_by(TrainingRecord.id.asc()).all()
    return [
        TrainingOut(
            id=row.id,
            employee_id=row.employee_id,
            employee_name=row.employee.name,
            course_name=row.course_name,
            status=row.status,
            start_date=row.start_date,
            end_date=row.end_date,
        )
        for row in rows
    ]


@app.get("/api/contracts", response_model=List[ContractOut])
def list_contracts(db: Session = Depends(get_db)):
    rows = db.query(ContractGPH).order_by(ContractGPH.id.asc()).all()
    return [
        ContractOut(
            id=row.id,
            contractor_name=row.contractor_name,
            contract_number=row.contract_number,
            month=row.month,
            hours_worked=row.hours_worked,
            hourly_rate=row.hourly_rate,
            total_amount=row.total_amount,
            status=row.status,
            jira_tasks=json.loads(row.jira_tasks_json),
        )
        for row in rows
    ]


@app.post("/api/contracts", response_model=ContractOut)
def create_contract(payload: ContractCreate, db: Session = Depends(get_db)):
    if payload.status not in CONTRACT_STATUSES:
        raise HTTPException(status_code=400, detail="Некорректный статус договора")

    total_amount = round(payload.hours_worked * payload.hourly_rate, 2)
    row = ContractGPH(
        contractor_name=payload.contractor_name,
        contract_number=payload.contract_number,
        month=payload.month,
        hours_worked=payload.hours_worked,
        hourly_rate=payload.hourly_rate,
        total_amount=total_amount,
        status=payload.status,
        jira_tasks_json=json.dumps(payload.jira_tasks, ensure_ascii=False),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return ContractOut(
        id=row.id,
        contractor_name=row.contractor_name,
        contract_number=row.contract_number,
        month=row.month,
        hours_worked=row.hours_worked,
        hourly_rate=row.hourly_rate,
        total_amount=row.total_amount,
        status=row.status,
        jira_tasks=json.loads(row.jira_tasks_json),
    )


@app.post("/api/contracts/{contract_id}/generate-act")
def generate_act(contract_id: int, db: Session = Depends(get_db)):
    contract = db.query(ContractGPH).filter(ContractGPH.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Договор не найден")

    act_data = {
        "act_number": f"ACT-{contract.contract_number}",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "contractor_name": contract.contractor_name,
        "contract_number": contract.contract_number,
        "month": contract.month,
        "hours_worked": contract.hours_worked,
        "hourly_rate": contract.hourly_rate,
        "total_amount": contract.total_amount,
        "jira_tasks": json.loads(contract.jira_tasks_json),
        "status": "generated",
        "signatory_company": "ООО Командный Центр",
    }
    return act_data


@app.get("/api/reports/salary-boxplot")
def report_salary_boxplot(db: Session = Depends(get_db)):
    employees = db.query(Employee).all()
    image = generate_salary_boxplot(employees)
    return {"image": image, "title": "Распределение зарплат по отделам"}


@app.get("/api/reports/engagement-heatmap")
def report_engagement_heatmap(db: Session = Depends(get_db)):
    employees = db.query(Employee).all()
    surveys = db.query(EngagementSurvey).all()
    image = generate_engagement_heatmap(employees, surveys)
    return {"image": image, "title": "Тепловая карта вовлечённости"}


@app.get("/api/reports/churn-factors")
def report_churn_factors(db: Session = Depends(get_db)):
    employees = db.query(Employee).all()
    surveys = db.query(EngagementSurvey).all()
    image = generate_churn_factors(employees, surveys)
    return {"image": image, "title": "Факторы влияния на отток"}


@app.get("/api/reports/hiring-funnel")
def report_hiring_funnel(db: Session = Depends(get_db)):
    candidates = db.query(Candidate).all()
    image = generate_hiring_funnel(candidates)
    return {"image": image, "title": "Воронка найма"}


@app.get("/api/reports/remote-vs-office")
def report_remote_vs_office(db: Session = Depends(get_db)):
    employees = db.query(Employee).all()
    surveys = db.query(EngagementSurvey).all()
    image = generate_remote_vs_office(employees, surveys)
    return {"image": image, "title": "Вовлечённость: удалённые vs офис"}


@app.get("/")
def healthcheck():
    return {"status": "ok", "service": "HR Command Center API"}
