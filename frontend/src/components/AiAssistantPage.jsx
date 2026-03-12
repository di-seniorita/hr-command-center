import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  checkAiHealth,
  compareCandidates,
  customAiQuery,
  fetchCandidates,
  summarizeCandidate,
} from "../api";

const quickPrompts = [
  "Выдели ключевые навыки",
  "Оцени soft skills",
  "Подходит ли для удалённой работы?",
  "Сравни опыт и технический стек",
];

function AiAssistantPage() {
  const [healthStatus, setHealthStatus] = useState("checking");
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [criteria, setCriteria] = useState("");
  const [hrPrompt, setHrPrompt] = useState("");
  const [activeMode, setActiveMode] = useState("summarize");
  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isCandidatesLoading, setIsCandidatesLoading] = useState(true);

  const selectedCount = selectedCandidateIds.length;

  const selectedCandidatesSet = useMemo(() => new Set(selectedCandidateIds), [selectedCandidateIds]);

  const statusDotClass =
    healthStatus === "ok"
      ? "bg-green-400"
      : healthStatus === "unavailable"
        ? "bg-red-400"
        : "bg-yellow-300";

  const statusLabel =
    healthStatus === "ok"
      ? "LLM подключен"
      : healthStatus === "unavailable"
        ? "LLM недоступен"
        : "Проверка статуса";

  const toggleCandidate = (candidateId) => {
    setSelectedCandidateIds((prev) => {
      if (prev.includes(candidateId)) {
        return prev.filter((id) => id !== candidateId);
      }
      return [...prev, candidateId];
    });
  };

  const loadInitialData = async () => {
    setIsCandidatesLoading(true);

    try {
      const [healthData, candidatesData] = await Promise.all([checkAiHealth(), fetchCandidates()]);

      if (healthData?.status && healthData.status !== "unavailable") {
        setHealthStatus("ok");
      } else {
        setHealthStatus("unavailable");
      }

      setCandidates(candidatesData);
    } catch {
      setHealthStatus("unavailable");
      toast.error("Не удалось загрузить данные AI модуля");
    } finally {
      setIsCandidatesLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleSummarize = async () => {
    if (selectedCount !== 1) {
      toast.error("Выберите ровно одного кандидата");
      return;
    }

    setLoading(true);
    setResponseText("");

    try {
      const data = await summarizeCandidate(selectedCandidateIds[0]);
      setResponseText(data.summary || "Ответ модели пустой");
      setActiveMode("summarize");
    } catch {
      toast.error("Не удалось получить суммаризацию");
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (selectedCount < 2) {
      toast.error("Для сравнения выберите минимум двух кандидатов");
      return;
    }

    if (!criteria.trim()) {
      toast.error("Введите критерий сравнения");
      return;
    }

    setLoading(true);
    setResponseText("");

    try {
      const data = await compareCandidates(selectedCandidateIds, criteria.trim());
      setResponseText(data.analysis || "Ответ модели пустой");
    } catch {
      toast.error("Не удалось выполнить сравнение кандидатов");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomQuery = async () => {
    if (selectedCount < 1) {
      toast.error("Выберите хотя бы одного кандидата");
      return;
    }

    if (!hrPrompt.trim()) {
      toast.error("Введите вопрос для AI");
      return;
    }

    setLoading(true);
    setResponseText("");

    try {
      const data = await customAiQuery(selectedCandidateIds, hrPrompt.trim());
      setResponseText(data.answer || "Ответ модели пустой");
    } catch {
      toast.error("Не удалось получить ответ AI");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">AI Ассистент</h2>
          <p className="mt-1 text-sm text-gray-400">Задавайте вопросы по кандидатам внешней LLM модели</p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass}`} />
          <span className="text-gray-200">{statusLabel}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <section className="rounded-xl border border-gray-800 bg-gray-800 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Выбор кандидатов</h3>
            <span className="text-xs text-gray-400">Выбрано: {selectedCount}</span>
          </div>

          <div className="max-h-[30rem] space-y-2 overflow-y-auto pr-1">
            {isCandidatesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={`ai-candidate-skeleton-${index}`} className="h-16 animate-pulse rounded-lg bg-gray-700" />
                ))}
              </div>
            ) : (
              candidates.map((candidate) => (
                <label
                  key={candidate.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-700 bg-gray-900/50 p-3 transition hover:border-gray-600"
                >
                  <input
                    type="checkbox"
                    checked={selectedCandidatesSet.has(candidate.id)}
                    onChange={() => toggleCandidate(candidate.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-100">{candidate.name}</p>
                    <p className="truncate text-xs text-gray-400">{candidate.vacancy_title}</p>
                    <p className="text-xs text-indigo-300">AI Score: {(candidate.ai_score || 0).toFixed(1)}%</p>
                  </div>
                </label>
              ))
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-gray-800 bg-gray-800 p-4">
          <h3 className="text-lg font-semibold">Действия</h3>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSummarize}
              disabled={loading || selectedCount !== 1}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Суммаризировать
            </button>

            <button
              type="button"
              onClick={() => setActiveMode("compare")}
              disabled={loading || selectedCount < 2}
              className="rounded-lg bg-blue-500/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Сравнить кандидатов
            </button>

            <button
              type="button"
              onClick={() => setActiveMode("custom")}
              disabled={loading || selectedCount < 1}
              className="rounded-lg bg-emerald-500/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Свободный вопрос
            </button>
          </div>

          {activeMode === "compare" && (
            <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-900/50 p-3">
              <label className="block text-sm text-gray-300">Критерий сравнения</label>
              <input
                value={criteria}
                onChange={(event) => setCriteria(event.target.value)}
                placeholder="Например: релевантность для backend позиции"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCompare}
                disabled={loading || selectedCount < 2 || !criteria.trim()}
                className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Выполнить сравнение
              </button>
            </div>
          )}

          {activeMode === "custom" && (
            <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-900/50 p-3">
              <label className="block text-sm text-gray-300">Ваш вопрос к AI</label>
              <textarea
                rows={5}
                value={hrPrompt}
                onChange={(event) => setHrPrompt(event.target.value)}
                placeholder="Например: кто из выбранных кандидатов лучше подходит под команду с высокой автономностью?"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
              />

              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setHrPrompt(prompt)}
                    className="rounded-full border border-gray-600 bg-gray-800 px-3 py-1 text-xs text-gray-200 transition hover:border-indigo-400 hover:text-indigo-300"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCustomQuery}
                disabled={loading || selectedCount < 1 || !hrPrompt.trim()}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Отправить вопрос
              </button>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-gray-700 bg-gray-800 p-4">
        <h3 className="mb-3 text-lg font-semibold">Ответ модели</h3>

        {loading ? (
          <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-900/60 p-4 text-gray-200">
            <Loader2 size={18} className="animate-spin text-indigo-300" />
            <span>Модель анализирует...</span>
          </div>
        ) : (
          <div className="min-h-40 whitespace-pre-wrap rounded-xl border border-gray-700 bg-gray-800 p-4 text-sm leading-6 text-gray-100">
            {responseText || "Здесь появится ответ AI после выполнения запроса."}
          </div>
        )}
      </section>
    </div>
  );
}

export default AiAssistantPage;
