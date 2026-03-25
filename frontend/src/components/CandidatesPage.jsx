import { useEffect, useMemo, useState } from "react";
import { Camera, Loader2, RefreshCw, Search, Upload } from "lucide-react";
import toast from "react-hot-toast";
import {
  createCandidate,
  fetchCandidates,
  fetchVacancies,
  parseResumeImage,
  rescoreCandidate,
  updateCandidate,
  uploadResume,
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

const initialUploadForm = {
  file: null,
  vacancy_id: "",
  candidate_name: "",
  candidate_email: "",
  experience_years: 1,
};

const initialImageParseForm = {
  file: null,
  vacancy_id: "",
};

function CandidatesPage() {
  const [candidates, setCandidates] = useState([]);
  const [vacancies, setVacancies] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [uploadForm, setUploadForm] = useState(initialUploadForm);
  const [imageParseForm, setImageParseForm] = useState(initialImageParseForm);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageRawResponse, setImageRawResponse] = useState("");
  const [loading, setLoading] = useState(true);
  const [rescoringCandidateId, setRescoringCandidateId] = useState(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isParsingImage, setIsParsingImage] = useState(false);
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

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

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

  const handleUploadResume = async (event) => {
    event.preventDefault();
    if (!uploadForm.file) {
      toast.error("Выберите PDF-файл");
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadForm.file);
    formData.append("vacancy_id", String(Number(uploadForm.vacancy_id)));
    formData.append("candidate_name", uploadForm.candidate_name);
    formData.append("candidate_email", uploadForm.candidate_email);
    formData.append("experience_years", String(Number(uploadForm.experience_years)));

    setIsUploadingResume(true);
    try {
      const candidate = await uploadResume(formData);
      toast.success(`Резюме загружено, AI-скор рассчитан: ${(candidate.ai_score || 0).toFixed(1)}%`);
      setUploadForm(initialUploadForm);
      setIsUploadModalOpen(false);
      await loadData();
    } finally {
      setIsUploadingResume(false);
    }
  };

  const handleImageSelected = (file) => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    if (!file) {
      setImageParseForm((prev) => ({ ...prev, file: null }));
      setImagePreviewUrl("");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setImageParseForm((prev) => ({ ...prev, file }));
    setImagePreviewUrl(previewUrl);
  };

  const handleParseResumeImage = async (event) => {
    event.preventDefault();

    if (!imageParseForm.file) {
      toast.error("Выберите изображение");
      return;
    }

    if (!imageParseForm.vacancy_id) {
      toast.error("Выберите вакансию");
      return;
    }

    const formData = new FormData();
    formData.append("file", imageParseForm.file);
    formData.append("vacancy_id", String(Number(imageParseForm.vacancy_id)));

    setIsParsingImage(true);
    setImageRawResponse("");

    try {
      const data = await parseResumeImage(formData);

      if (data?.candidate) {
        toast.success(`Резюме распознано! AI-скор: ${(data.candidate.ai_score || 0).toFixed(1)}%`);
        setIsImageModalOpen(false);
        setImageParseForm(initialImageParseForm);
        if (imagePreviewUrl) {
          URL.revokeObjectURL(imagePreviewUrl);
        }
        setImagePreviewUrl("");
        setImageRawResponse("");
        await loadData();
        return;
      }

      setImageRawResponse(data?.raw_llm_response || "");
      toast.error("Не удалось автоматически распознать");
    } catch (error) {
      const rawText = error?.response?.data?.raw_llm_response || "";
      setImageRawResponse(rawText);
      toast.error("Не удалось автоматически распознать");
    } finally {
      setIsParsingImage(false);
    }
  };

  const handleCloseImageModal = () => {
    setIsImageModalOpen(false);
    setImageParseForm(initialImageParseForm);
    setImageRawResponse("");
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl("");
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
        <div className="h-10 w-64 animate-pulse rounded-lg bg-gray-800" />
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
          <div className="mb-4 h-10 w-72 animate-pulse rounded-lg bg-gray-700" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`candidate-skeleton-${index}`} className="grid grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((__, cellIndex) => (
                  <div
                    key={`candidate-skeleton-${index}-${cellIndex}`}
                    className="h-8 animate-pulse rounded bg-gray-700"
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Кандидаты</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-400"
          >
            Добавить кандидата
          </button>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 font-medium text-gray-100 hover:bg-gray-700"
          >
            <Upload size={16} />
            Загрузить резюме (PDF)
          </button>
          <button
            onClick={() => setIsImageModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 font-medium text-gray-100 hover:bg-gray-700"
          >
            <Camera size={16} />
            Распознать фото резюме
          </button>
        </div>
      </div>

      <div className="max-w-md rounded-xl border border-gray-800 bg-gray-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Поиск по имени..."
            className="w-full bg-transparent text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none"
          />
        </div>
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
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>

              <label className="space-y-1 text-sm md:col-span-1">
                <span className="text-gray-300">Email</span>
                <input
                  required
                  type="email"
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </label>

              <label className="space-y-1 text-sm md:col-span-1">
                <span className="text-gray-300">Вакансия</span>
                <select
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                  value={form.vacancy_id}
                  onChange={(event) => setForm((prev) => ({ ...prev, vacancy_id: event.target.value }))}
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
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, experience_years: event.target.value }))
                  }
                />
              </label>

              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-gray-300">Резюме</span>
                <textarea
                  required
                  rows={4}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                  value={form.resume_text}
                  onChange={(event) => setForm((prev) => ({ ...prev, resume_text: event.target.value }))}
                />
              </label>

              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-gray-300">Навыки (через запятую)</span>
                <input
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                  value={form.skillsText}
                  onChange={(event) => setForm((prev) => ({ ...prev, skillsText: event.target.value }))}
                />
              </label>

              <label className="space-y-1 text-sm md:col-span-1">
                <span className="text-gray-300">Статус</span>
                <select
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                  value={form.status}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex justify-end gap-3 pt-2 md:col-span-2">
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

      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-xl border border-gray-700 bg-gray-900 p-6">
            <h3 className="mb-4 text-xl font-semibold">Загрузка резюме (PDF)</h3>
            <form onSubmit={handleUploadResume} className="grid gap-4">
              <label className="space-y-1 text-sm">
                <span className="text-gray-300">PDF файл</span>
                <input
                  required
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(event) =>
                    setUploadForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 file:mr-3 file:rounded-md file:border-0 file:bg-gray-700 file:px-3 file:py-1 file:text-gray-100"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-gray-300">Вакансия</span>
                <select
                  required
                  value={uploadForm.vacancy_id}
                  onChange={(event) =>
                    setUploadForm((prev) => ({ ...prev, vacancy_id: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                >
                  <option value="">Выберите вакансию</option>
                  {vacancies.map((vacancy) => (
                    <option key={vacancy.id} value={vacancy.id}>
                      {vacancy.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-gray-300">Имя кандидата</span>
                <input
                  required
                  value={uploadForm.candidate_name}
                  onChange={(event) =>
                    setUploadForm((prev) => ({ ...prev, candidate_name: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-gray-300">Email кандидата</span>
                <input
                  required
                  type="email"
                  value={uploadForm.candidate_email}
                  onChange={(event) =>
                    setUploadForm((prev) => ({ ...prev, candidate_email: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="text-gray-300">Опыт (лет)</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.5"
                  value={uploadForm.experience_years}
                  onChange={(event) =>
                    setUploadForm((prev) => ({ ...prev, experience_years: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                />
              </label>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-gray-300"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isUploadingResume}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isUploadingResume && <Loader2 size={16} className="animate-spin" />}
                  Загрузить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isImageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-700 bg-gray-900 p-6">
            <h3 className="mb-4 text-xl font-semibold">Распознавание фото резюме</h3>
            <form onSubmit={handleParseResumeImage} className="grid gap-4">
              <label className="space-y-1 text-sm">
                <span className="text-gray-300">Изображение (JPG / PNG / WEBP)</span>
                <input
                  required
                  type="file"
                  accept="image/*"
                  onChange={(event) => handleImageSelected(event.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 file:mr-3 file:rounded-md file:border-0 file:bg-gray-700 file:px-3 file:py-1 file:text-gray-100"
                />
              </label>

              {imagePreviewUrl && (
                <div className="rounded-lg border border-gray-700 bg-gray-800 p-3">
                  <p className="mb-2 text-sm text-gray-300">Предпросмотр</p>
                  <img
                    src={imagePreviewUrl}
                    alt="Предпросмотр резюме"
                    className="max-h-64 w-full rounded-md object-contain"
                  />
                </div>
              )}

              <label className="space-y-1 text-sm">
                <span className="text-gray-300">Вакансия</span>
                <select
                  required
                  value={imageParseForm.vacancy_id}
                  onChange={(event) =>
                    setImageParseForm((prev) => ({ ...prev, vacancy_id: event.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
                >
                  <option value="">Выберите вакансию</option>
                  {vacancies.map((vacancy) => (
                    <option key={vacancy.id} value={vacancy.id}>
                      {vacancy.title}
                    </option>
                  ))}
                </select>
              </label>

              {imageRawResponse && (
                <label className="space-y-1 text-sm">
                  <span className="text-gray-300">Сырой ответ модели</span>
                  <textarea
                    readOnly
                    rows={6}
                    value={imageRawResponse}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-200"
                  />
                </label>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="text-sm text-indigo-300">
                  {isParsingImage ? "AI анализирует изображение..." : ""}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCloseImageModal}
                    className="rounded-lg border border-gray-600 px-4 py-2 text-gray-300"
                    disabled={isParsingImage}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={isParsingImage}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isParsingImage && <Loader2 size={16} className="animate-spin" />}
                    Распознать
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CandidatesPage;
