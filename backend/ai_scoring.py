from __future__ import annotations

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def score_candidate(candidate_text: str, vacancy_text: str) -> float:
    """Return similarity score between candidate and vacancy texts in range 0..100."""
    candidate_doc = (candidate_text or "").strip()
    vacancy_doc = (vacancy_text or "").strip()

    if not candidate_doc or not vacancy_doc:
        return 0.0

    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform([candidate_doc, vacancy_doc])
    similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]

    score = max(0.0, min(100.0, float(similarity * 100)))
    return round(score, 2)
