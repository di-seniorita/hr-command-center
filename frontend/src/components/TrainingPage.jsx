import { useEffect, useState } from "react";
import { fetchTraining } from "../api";

const statusLabels = {
  planned: "Запланировано",
  in_progress: "В процессе",
  completed: "Завершено",
};

const badgeStyles = {
  planned: "bg-blue-500/20 text-blue-300",
  in_progress: "bg-yellow-500/20 text-yellow-300",
  completed: "bg-green-500/20 text-green-300",
};

function TrainingPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchTraining(statusFilter);
        setRecords(data);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [statusFilter]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded-lg bg-gray-800 animate-pulse" />
        <div className="h-10 w-44 rounded-lg bg-gray-800 animate-pulse" />
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`training-skeleton-${index}`} className="grid grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((__, cellIndex) => (
                  <div
                    key={`training-skeleton-${index}-${cellIndex}`}
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Обучение сотрудников</h2>
        <select
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="planned">Запланировано</option>
          <option value="in_progress">В процессе</option>
          <option value="completed">Завершено</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-800">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-900/70">
            <tr>
              <th className="table-header-cell">Сотрудник</th>
              <th className="table-header-cell">Курс</th>
              <th className="table-header-cell">Статус</th>
              <th className="table-header-cell">Дата начала</th>
              <th className="table-header-cell">Дата завершения</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-gray-700/30">
                <td className="table-cell">{record.employee_name}</td>
                <td className="table-cell">{record.course_name}</td>
                <td className="table-cell">
                  <span className={`rounded-full px-3 py-1 text-xs ${badgeStyles[record.status]}`}>
                    {statusLabels[record.status]}
                  </span>
                </td>
                <td className="table-cell">{record.start_date}</td>
                <td className="table-cell">{record.end_date || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TrainingPage;
