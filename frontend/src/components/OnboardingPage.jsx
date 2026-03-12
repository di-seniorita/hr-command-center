import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  createOnboardingTask,
  fetchEmployees,
  fetchOnboardingTasks,
  updateOnboardingTask,
} from "../api";

const categoryLabels = {
  documents: "Документы",
  access: "Доступы",
  training: "Обучение",
  intro: "Введение",
};

const defaultTaskForm = {
  title: "",
  description: "",
  due_date: "",
  category: "documents",
};

function OnboardingPage() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskForm, setTaskForm] = useState(defaultTaskForm);

  useEffect(() => {
    const loadEmployees = async () => {
      setLoading(true);
      try {
        const data = await fetchEmployees({ status: "onboarding" });
        setEmployees(data);
        if (data.length > 0) {
          setSelectedEmployeeId(String(data[0].id));
        }
      } finally {
        setLoading(false);
      }
    };

    loadEmployees();
  }, []);

  useEffect(() => {
    const loadTasks = async () => {
      if (!selectedEmployeeId) {
        setTasks([]);
        return;
      }
      const data = await fetchOnboardingTasks(selectedEmployeeId);
      setTasks(data);
    };

    loadTasks();
  }, [selectedEmployeeId]);

  const groupedTasks = useMemo(() => {
    return tasks.reduce((acc, task) => {
      const key = task.category;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(task);
      return acc;
    }, {});
  }, [tasks]);

  const completion = useMemo(() => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter((task) => task.is_completed).length;
    return Math.round((completed / tasks.length) * 100);
  }, [tasks]);

  const toggleTask = async (task) => {
    if (!selectedEmployeeId) return;
    await updateOnboardingTask(selectedEmployeeId, {
      id: task.id,
      is_completed: !task.is_completed,
    });
    toast.success("Задача обновлена");
    const refreshed = await fetchOnboardingTasks(selectedEmployeeId);
    setTasks(refreshed);
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();
    if (!selectedEmployeeId) return;

    await createOnboardingTask(selectedEmployeeId, {
      ...taskForm,
      is_completed: false,
    });

    toast.success("Задача добавлена");
    setTaskForm(defaultTaskForm);
    const refreshed = await fetchOnboardingTasks(selectedEmployeeId);
    setTasks(refreshed);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-72 rounded-lg bg-gray-800 animate-pulse" />
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
          <div className="h-10 w-full max-w-lg rounded-lg bg-gray-700 animate-pulse" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`onboarding-skeleton-${index}`}
              className="h-44 rounded-xl border border-gray-800 bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Онбординг сотрудников</h2>

      <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
        <label className="mb-3 block text-sm text-gray-300">Сотрудник на адаптации</label>
        <select
          className="w-full max-w-lg rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
          value={selectedEmployeeId}
          onChange={(e) => setSelectedEmployeeId(e.target.value)}
        >
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} — {employee.position}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
        <div className="mb-2 flex justify-between text-sm text-gray-300">
          <span>Прогресс выполнения</span>
          <span>{completion}%</span>
        </div>
        <div className="h-3 rounded bg-gray-700">
          <div
            className="h-3 rounded bg-indigo-500 transition-all"
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Object.entries(categoryLabels).map(([categoryKey, categoryLabel]) => (
          <div key={categoryKey} className="rounded-xl border border-gray-800 bg-gray-800 p-4">
            <h3 className="mb-3 text-lg font-semibold">{categoryLabel}</h3>
            <div className="space-y-2">
              {(groupedTasks[categoryKey] || []).map((task) => (
                <label
                  key={task.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg bg-gray-900 p-3"
                >
                  <input
                    type="checkbox"
                    checked={task.is_completed}
                    onChange={() => toggleTask(task)}
                    className="mt-1 h-4 w-4"
                  />
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-gray-400">{task.description}</p>
                    <p className="text-xs text-gray-500">Срок: {task.due_date}</p>
                  </div>
                </label>
              ))}
              {(groupedTasks[categoryKey] || []).length === 0 && (
                <p className="text-sm text-gray-500">Нет задач в категории.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
        <h3 className="mb-4 text-lg font-semibold">Добавить задачу</h3>
        <form onSubmit={handleCreateTask} className="grid gap-4 md:grid-cols-2">
          <input
            required
            placeholder="Название задачи"
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
            value={taskForm.title}
            onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
          />
          <input
            required
            type="date"
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
            value={taskForm.due_date}
            onChange={(e) => setTaskForm((prev) => ({ ...prev, due_date: e.target.value }))}
          />
          <select
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
            value={taskForm.category}
            onChange={(e) => setTaskForm((prev) => ({ ...prev, category: e.target.value }))}
          >
            {Object.entries(categoryLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <textarea
            required
            rows={3}
            placeholder="Описание задачи"
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 md:col-span-2"
            value={taskForm.description}
            onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
          />
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-400"
            >
              Добавить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default OnboardingPage;
