from __future__ import annotations

import base64
from datetime import date
from io import BytesIO
from typing import Iterable, List

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

from ai_churn import train_churn_model

sns.set_theme(style="darkgrid", palette="muted")

plt.rcParams["figure.facecolor"] = "#1f2937"
plt.rcParams["axes.facecolor"] = "#111827"
plt.rcParams["savefig.facecolor"] = "#1f2937"
plt.rcParams["text.color"] = "white"
plt.rcParams["axes.labelcolor"] = "white"
plt.rcParams["axes.edgecolor"] = "#374151"
plt.rcParams["xtick.color"] = "#9ca3af"
plt.rcParams["ytick.color"] = "#9ca3af"


def _figure_to_base64(fig: plt.Figure) -> str:
    """Convert matplotlib figure to base64-encoded PNG string."""
    buffer = BytesIO()
    fig.tight_layout()
    fig.savefig(buffer, format="png", dpi=140)
    buffer.seek(0)
    encoded = base64.b64encode(buffer.read()).decode("utf-8")
    buffer.close()
    plt.close(fig)
    return encoded


def _empty_chart(title: str, message: str) -> str:
    """Generate a standard fallback chart when no data is available."""
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.set_title(title, fontsize=14, pad=12)
    ax.text(0.5, 0.5, message, ha="center", va="center", fontsize=12, color="#d1d5db")
    ax.set_xticks([])
    ax.set_yticks([])
    return _figure_to_base64(fig)


def generate_salary_boxplot(employees: Iterable) -> str:
    """Generate salary distribution boxplot grouped by department."""
    rows = [
        {"department": employee.department, "salary": float(employee.salary)}
        for employee in employees
        if employee.status in {"active", "onboarding", "fired"}
    ]
    if not rows:
        return _empty_chart("Распределение зарплат по отделам", "Недостаточно данных для построения")

    data_frame = pd.DataFrame(rows)
    fig, ax = plt.subplots(figsize=(11, 5.5))
    sns.boxplot(data=data_frame, y="department", x="salary", orient="h", ax=ax, palette="viridis")
    ax.set_title("Распределение зарплат по отделам", fontsize=14, pad=12)
    ax.set_xlabel("Зарплата")
    ax.set_ylabel("Отдел")
    return _figure_to_base64(fig)


def generate_engagement_heatmap(employees: Iterable, surveys: Iterable) -> str:
    """Generate engagement heatmap by department over the last 6 months."""
    employee_list = list(employees)
    survey_list = list(surveys)
    if not employee_list or not survey_list:
        return _empty_chart("Тепловая карта вовлечённости", "Недостаточно данных для построения")

    department_by_employee = {employee.id: employee.department for employee in employee_list}
    departments = sorted({employee.department for employee in employee_list})

    today = date.today()
    month_starts: List[date] = []
    for shift in range(5, -1, -1):
        month = today.month - shift
        year = today.year
        while month <= 0:
            month += 12
            year -= 1
        month_starts.append(date(year, month, 1))

    month_labels = [month.strftime("%m.%Y") for month in month_starts]

    matrix = np.full((len(departments), len(month_starts)), np.nan)

    for row_index, department in enumerate(departments):
        for col_index, month_start in enumerate(month_starts):
            month_end = date(month_start.year + (month_start.month // 12), (month_start.month % 12) + 1, 1)
            values = [
                survey.score_1_to_10
                for survey in survey_list
                if department_by_employee.get(survey.employee_id) == department
                and month_start <= survey.date < month_end
            ]
            if values:
                matrix[row_index, col_index] = float(np.mean(values))

    fig, ax = plt.subplots(figsize=(11, 5.8))
    sns.heatmap(
        matrix,
        ax=ax,
        annot=True,
        fmt=".1f",
        cmap=sns.color_palette("YlOrRd_r", as_cmap=True),
        linewidths=0.5,
        linecolor="#374151",
        xticklabels=month_labels,
        yticklabels=departments,
        cbar_kws={"label": "Средняя вовлечённость"},
    )
    ax.set_title("Тепловая карта вовлечённости", fontsize=14, pad=12)
    ax.set_xlabel("Месяцы")
    ax.set_ylabel("Отдел")
    return _figure_to_base64(fig)


def generate_churn_factors(employees: Iterable, surveys: Iterable) -> str:
    """Generate churn-factor chart from LogisticRegression coefficients."""
    employee_list = list(employees)
    survey_list = list(surveys)
    if not employee_list:
        return _empty_chart("Факторы влияния на отток", "Недостаточно данных для построения")

    try:
        churn_bundle = train_churn_model(employee_list, survey_list)
        coefficients = churn_bundle.model.coef_[0]
    except ValueError:
        return _empty_chart("Факторы влияния на отток", "Недостаточно данных для обучения модели")

    feature_names = ["Стаж", "Вовлечённость", "Удалённость", "Зарплата", "Отдел"]
    if len(coefficients) != len(feature_names):
        return _empty_chart("Факторы влияния на отток", "Ошибка размерности признаков модели")

    colors = ["#ef4444" if value > 0 else "#22c55e" for value in coefficients]

    fig, ax = plt.subplots(figsize=(10.5, 5.5))
    y_positions = np.arange(len(feature_names))
    ax.barh(y_positions, coefficients, color=colors, alpha=0.9)
    ax.set_yticks(y_positions)
    ax.set_yticklabels(feature_names)
    ax.axvline(x=0, color="#9ca3af", linewidth=1)
    ax.set_title("Факторы влияния на отток", fontsize=14, pad=12)
    ax.set_xlabel("Влияние на вероятность оттока")
    return _figure_to_base64(fig)


def generate_hiring_funnel(candidates: Iterable) -> str:
    """Generate hiring funnel chart by candidate status."""
    statuses = ["new", "screening", "interview", "offer", "rejected"]
    labels = ["Новые", "Скрининг", "Интервью", "Оффер", "Отклонённые"]
    candidate_list = list(candidates)

    counts = [sum(1 for candidate in candidate_list if candidate.status == status) for status in statuses]
    if sum(counts) == 0:
        return _empty_chart("Воронка найма", "Недостаточно данных для построения")

    colors = ["#2563eb", "#3b82f6", "#14b8a6", "#22c55e", "#4ade80"]

    fig, ax = plt.subplots(figsize=(10.5, 5.5))
    y_positions = np.arange(len(labels))
    ax.barh(y_positions, counts, color=colors, alpha=0.95)
    ax.set_yticks(y_positions)
    ax.set_yticklabels(labels)
    ax.invert_yaxis()
    ax.set_xlabel("Количество кандидатов")
    ax.set_title("Воронка найма", fontsize=14, pad=12)
    return _figure_to_base64(fig)


def generate_remote_vs_office(employees: Iterable, surveys: Iterable) -> str:
    """Generate violin plot comparing engagement of remote and office employees."""
    employee_list = list(employees)
    survey_list = list(surveys)
    if not employee_list or not survey_list:
        return _empty_chart("Вовлечённость: удалённые vs офис", "Недостаточно данных для построения")

    remote_map = {employee.id: employee.is_remote for employee in employee_list}
    rows = []
    for survey in survey_list:
        is_remote = remote_map.get(survey.employee_id)
        if is_remote is None:
            continue
        rows.append(
            {
                "Формат": "Удалённо" if is_remote else "Офис",
                "Вовлечённость": survey.score_1_to_10,
            }
        )

    if not rows:
        return _empty_chart("Вовлечённость: удалённые vs офис", "Недостаточно данных для построения")

    data_frame = pd.DataFrame(rows)
    fig, ax = plt.subplots(figsize=(10.5, 5.5))
    sns.violinplot(data=data_frame, x="Формат", y="Вовлечённость", palette="Set2", ax=ax, inner="quart")
    ax.set_title("Вовлечённость: удалённые vs офис", fontsize=14, pad=12)
    ax.set_xlabel("Формат работы")
    ax.set_ylabel("Оценка вовлечённости")
    return _figure_to_base64(fig)
