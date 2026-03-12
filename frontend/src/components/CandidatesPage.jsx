import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import toast from "react-hot-toast";
import {
  createCandidate,
  fetchCandidates,
  fetchVacancies,
  rescoreCandidate,
  updateCandidate,
} from "../api";

const statusOptions = ["new", "screening", "interview", "offer", "rejected"];

const statusLabels = {
  new: "Новый",
  screening: "Скрининг",
  interview: "Интервью",
  offer: "Оффер",
  rejected: "Отклонен",
};

const statusBadgeClass = {
  new: "bg-blue-500/20 text-blue-300",
  screening: "bg-yellow-500/20 text-yellow-300",
  interview: "bg-purple-500/20 text-purple-300",
  offer: "bg-green-500/20 text-green-300",
  rejected: "bg-red-500/20 text-red-300",
};

function scoreColor(score) {
  if (score < 30) return "bg-red-500";
  if (score <= 70) return "bg-yellow-500";
  return "bg-green-500";
}

const initialForm = {
  name: "",
  email: "",
  vacancy_id: "",
  resume_text: "",
  skillsText: "",
  experience_years: 1,
  status: "new",
};

function CandidatesPage() {
  const [candidates, setCandidates] = useState([]);
  const [vacancies, setVacancies] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [rescoringCandidateId, setRescoringCandidateId] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [candidatesData, vacanciesData] = await Promise.all([fetchCandidates(), fetchVacancies()]);
      setCandidates(candidatesData);
      setVacancies(vacanciesData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchTerm(searchInput.trim().toLowerCase());
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [searchInput]);

  const vacancyMap = useMemo(() => {
    return vacancies.reduce((acc, vacancy) => {
      acc[vacancy.id] = vacancy.title;
      return acc;
    }, {});
  }, [vacancies]);

  const filteredCandidates = useMemo(() => {
    if (!searchTerm) {
      return candidates;
    }

    return candidates.filter((candidate) => candidate.name.toLowerCase().includes(searchTerm));
  }, [candidates, searchTerm]);

  const handleCreate = async (event) => {
    event.preventDefault();
    const payload = {
      name: form.name,
      email: form.email,
      vacancy_id: Number(form.vacancy_id),
      resume_text: form.resume_text,
      skills: form.skillsText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      experience_years: Number(form.experience_years),
      status: form.status,
    };

    await createCandidate(payload);
    toast.success("Кандидат добавлен");
    setForm(initialForm);
    setIsModalOpen(false);
    await loadData();
  };

  const handleStatusChange = async (candidate) => {
    const currentIndex = statusOptions.indexOf(candidate.status);
    const nextStatus = statusOptions[(currentIndex + 1) % statusOptions.length];
    await updateCandidate(candidate.id, { status: nextStatus });
    toast.success("Статус обновлён");
    await loadData();
  };

  const handleRescore = async (candidateId) => {
    setRescoringCandidateId(candidateId);
    try {
      await rescoreCandidate(candidateId);
      toast.success("AI-скор пересчитан");
      await loadData();
    } finally {
      setRescoringCandidateId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 rounded-lg bg-gray-800 animate-pulse" />
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
          <div className="mb-4 h-10 w-72 rounded-lg bg-gray-700 animate-pulse" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`candidate-skeleton-${index}`} className="grid grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((__, cellIndex) => (
                  <div
                    key={`candidate-skeleton-${index}-${cellIndex}`}
                    className="h-8 rounded bg-gray-700 animate-pulse"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Кандидаты</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-400"
        >
          Добавить кандидата
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-800 px-3 py-2 max-w-md">
        <Search size={16} className="text-gray-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Поиск по имени..."
          className="w-full bg-transparent text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-800">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-900/70">
            <tr>
              <th className="table-header-cell">Имя</th>
              <th className="table-header-cell">Вакансия</th>
              <th className="table-header-cell">Опыт (лет)</th>
              <th className="table-header-cell">AI Score</th>
              <th className="table-header-cell">Статус</th>
              <th className="table-header-cell">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredCandidates.map((candidate) => (
              <tr key={candidate.id} className="hover:bg-gray-700/30">
                <td className="table-cell">
                  <p className="font-medium">{candidate.name}</p>
                  <p className="text-xs text-gray-400">{candidate.email}</p>
                </td>
                <td className="table-cell">{vacancyMap[candidate.vacancy_id] || candidate.vacancy_title}</td>
                <td className="table-cell">{candidate.experience_years}</td>
                <td className="table-cell">
                  <div className="flex items-center gap-3">
                    <div className="w-44">
                      <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
                        <span>Совпадение</span>
                        <span>{(candidate.ai_score || 0).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded bg-gray-700">
                        <div
                          className={`h-2 rounded ${scoreColor(candidate.ai_score || 0)}`}
                          style={{ width: `${Math.min(100, candidate.ai_score || 0)}%` }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRescore(candidate.id)}
                      disabled={rescoringCandidateId === candidate.id}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-600 text-gray-300 transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Пересчитать AI-скор"
                    >
                      {rescoringCandidateId === candidate.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                    </button>
                  </div>
                </td>
                <td className="table-cell">
                  <span className={`rounded-full px-3 py-1 text-xs ${statusBadgeClass[candidate.status]}`}>
                    {statusLabels[candidate.status]}
                  </span>
                </td>
                <td className="table-cell">
                  <button
                    onClick={() => handleStatusChange(candidate)}
                    className="rounded-md bg-gray-700 px-3 py-2 text-xs font-medium hover:bg-gray-600"
                  >
                    Сменить статус
                  </button>
                </td>
              </tr>
            ))}
            {filteredCandidates.length === 0 && (
              <tr>
                <td className="table-cell text-center text-gray-400" colSpan={6}>
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-700 bg-gray-900 p-6">
            <h3 className="mb-4 text-xl font-semibold">Новый кандидат</h3>
            <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm md:col-span-1">
                <span className="text-gray-300">Имя</span>
                <input
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>

              <label className="space-y-1 text-sm md:col-span-1">
                <span className="text-gray-300">Email</span>
                <input
                  required
                  type="email"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </label>

              <label className="space-y-1 text-sm md:col-span-1">
                <span className="text-gray-300">Вакансия</span>
                <select
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                  value={form.vacancy_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, vacancy_id: e.target.value }))}
                >
                  <option value="">Выберите вакансию</option>
                  {vacancies.map((vacancy) => (
                    <option key={vacancy.id} value={vacancy.id}>
                      {vacancy.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm md:col-span-1">
                <span className="text-gray-300">Опыт (лет)</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.5"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                  value={form.experience_years}
                  onChange={(e) => setForm((prev) => ({ ...prev, experience_years: e.target.value }))}
                />
              </label>

              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-gray-300">Резюме</span>
                <textarea
                  required
                  rows={4}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                  value={form.resume_text}
                  onChange={(e) => setForm((prev) => ({ ...prev, resume_text: e.target.value }))}
                />
              </label>

              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-gray-300">Навыки (через запятую)</span>
                <input
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                  value={form.skillsText}
                  onChange={(e) => setForm((prev) => ({ ...prev, skillsText: e.target.value }))}
                />
              </label>

              <label className="space-y-1 text-sm md:col-span-1">
                <span className="text-gray-300">Статус</span>
                <select
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-gray-300"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-400"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CandidatesPage;
