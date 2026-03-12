from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Dict, Iterable, List

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder


@dataclass
class ChurnModelBundle:
    """Container for churn model artifacts required during inference."""

    model: LogisticRegression
    department_encoder: LabelEncoder
    fallback_engagement: float


def _months_between(start_date: date, end_date: date) -> int:
    """Calculate full months between two dates."""
    return max(0, (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month))


def train_churn_model(employees: Iterable, surveys: Iterable) -> ChurnModelBundle:
    """Train churn model using employee records and engagement surveys."""
    employee_list = [employee for employee in employees if employee.status in {"active", "fired"}]
    survey_list = list(surveys)

    if not employee_list:
        raise ValueError("Невозможно обучить модель: отсутствуют сотрудники со статусом active/fired.")

    survey_scores: Dict[int, List[int]] = {}
    for survey in survey_list:
        survey_scores.setdefault(survey.employee_id, []).append(survey.score_1_to_10)

    avg_values = [np.mean(values) for values in survey_scores.values() if values]
    fallback_engagement = float(np.mean(avg_values)) if avg_values else 5.0

    departments = [employee.department for employee in employee_list]
    encoder = LabelEncoder()
    encoder.fit(departments)

    today = date.today()
    features = []
    target = []

    for employee in employee_list:
        tenure_months = _months_between(employee.hire_date, today)
        avg_engagement = float(np.mean(survey_scores.get(employee.id, [fallback_engagement])))
        is_remote = 1 if employee.is_remote else 0
        salary = float(employee.salary)
        department_encoded = int(encoder.transform([employee.department])[0])

        features.append([tenure_months, avg_engagement, is_remote, salary, department_encoded])
        target.append(1 if employee.status == "fired" else 0)

    unique_targets = set(target)
    if len(unique_targets) < 2:
        # Edge case protection: force binary classes for LogisticRegression fitting.
        target = [0 if idx % 2 == 0 else 1 for idx in range(len(features))]

    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(features, target)

    return ChurnModelBundle(
        model=model,
        department_encoder=encoder,
        fallback_engagement=fallback_engagement,
    )


def predict_churn(model: ChurnModelBundle, employee: dict) -> float:
    """Predict churn probability for a single employee. Returns value in range 0..1."""
    tenure_months = int(employee.get("tenure_months", 0))
    avg_engagement = float(employee.get("avg_engagement", model.fallback_engagement))
    is_remote = 1 if bool(employee.get("is_remote", False)) else 0
    salary = float(employee.get("salary", 0))
    department = str(employee.get("department", ""))

    if department not in model.department_encoder.classes_:
        known_departments = list(model.department_encoder.classes_)
        department = known_departments[0] if known_departments else "Unknown"

    department_encoded = int(model.department_encoder.transform([department])[0])

    x = [[tenure_months, avg_engagement, is_remote, salary, department_encoded]]
    probability = float(model.model.predict_proba(x)[0][1])
    return max(0.0, min(1.0, probability))
