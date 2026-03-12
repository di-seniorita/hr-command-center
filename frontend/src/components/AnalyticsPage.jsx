import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { fetchAnalytics, fetchChurnRisk } from "../api";

const pieColors = ["#818CF8", "#22D3EE", "#34D399", "#FBBF24", "#F87171"];

function churnColor(value) {
  if (value >= 0.7) return "text-red-400";
  if (value >= 0.4) return "text-yellow-300";
  return "text-green-400";
}

function getRiskDotColor(churnProbability) {
  if (churnProbability >= 0.7) return "#F87171";
  if (churnProbability >= 0.4) return "#FACC15";
  return "#4ADE80";
}

function ChurnScatterTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-3 text-sm text-gray-100">
      <p className="font-semibold">{point.name}</p>
      <p className="text-gray-400">{point.department}</p>
      <p>Риск оттока: {(point.churn_probability * 100).toFixed(1)}%</p>
      <p>Стаж: {point.tenure_months} мес.</p>
      <p>Вовлечённость: {point.avg_engagement}</p>
    </div>
  );
}

function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [churnRisk, setChurnRisk] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [analyticsData, churnData] = await Promise.all([fetchAnalytics(), fetchChurnRisk()]);
        setAnalytics(analyticsData);
        setChurnRisk(churnData);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const salaryDomain = useMemo(() => {
    if (churnRisk.length === 0) {
      return [0, 1];
    }

    const salaryValues = churnRisk.map((row) => row.salary);
    const minSalary = Math.min(...salaryValues);
    const maxSalary = Math.max(...salaryValues);

    if (minSalary === maxSalary) {
      return [minSalary - 1, maxSalary + 1];
    }

    return [minSalary, maxSalary];
  }, [churnRisk]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded-lg bg-gray-800 animate-pulse" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-80 rounded-xl bg-gray-800 animate-pulse" />
          <div className="h-80 rounded-xl bg-gray-800 animate-pulse" />
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`analytics-skeleton-${index}`} className="grid grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((__, cellIndex) => (
                  <div
                    key={`analytics-skeleton-${index}-${cellIndex}`}
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
      <h2 className="text-2xl font-bold">Аналитика + AI</h2>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
          <h3 className="mb-4 text-lg font-semibold">Распределение сотрудников по отделам</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.department_distribution}
                  dataKey="count"
                  nameKey="department"
                  outerRadius={110}
                  label
                >
                  {analytics.department_distribution.map((entry, index) => (
                    <Cell key={entry.department} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
          <h3 className="mb-4 text-lg font-semibold">Средняя вовлеченность по отделам</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.engagement_by_department}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="department" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip />
                <Bar dataKey="avg_engagement" fill="#22D3EE" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
        <h3 className="mb-3 text-lg font-semibold">Прогноз оттока</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900/70">
              <tr>
                <th className="table-header-cell">Сотрудник</th>
                <th className="table-header-cell">Отдел</th>
                <th className="table-header-cell">Вовлеченность</th>
                <th className="table-header-cell">Стаж (мес.)</th>
                <th className="table-header-cell">Риск оттока</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {churnRisk.map((row) => (
                <tr key={row.employee_id}>
                  <td className="table-cell">{row.name}</td>
                  <td className="table-cell">{row.department}</td>
                  <td className="table-cell">{row.avg_engagement}</td>
                  <td className="table-cell">{row.tenure_months}</td>
                  <td className={`table-cell font-semibold ${churnColor(row.churn_probability)}`}>
                    {(row.churn_probability * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
        <h3 className="mb-4 text-lg font-semibold">Карта риска оттока</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                type="number"
                dataKey="tenure_months"
                name="Стаж"
                unit=" мес."
                stroke="#9CA3AF"
                label={{ value: "Стаж (мес.)", position: "insideBottom", offset: -5, fill: "#9CA3AF" }}
              />
              <YAxis
                type="number"
                dataKey="avg_engagement"
                name="Вовлечённость"
                stroke="#9CA3AF"
                label={{ value: "Вовлечённость", angle: -90, position: "insideLeft", fill: "#9CA3AF" }}
              />
              <ZAxis
                type="number"
                dataKey="salary"
                name="Зарплата"
                domain={salaryDomain}
                range={[60, 200]}
              />
              <Tooltip content={<ChurnScatterTooltip />} />
              <Scatter data={churnRisk}>
                {churnRisk.map((entry) => (
                  <Cell key={`scatter-cell-${entry.employee_id}`} fill={getRiskDotColor(entry.churn_probability)} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="max-w-sm rounded-xl border border-gray-800 bg-gray-800 p-5">
        <p className="text-sm text-gray-400">Доля удаленных сотрудников</p>
        <p className="mt-2 text-4xl font-bold text-indigo-300">{analytics.remote_percentage}%</p>
      </div>
    </div>
  );
}

export default AnalyticsPage;
