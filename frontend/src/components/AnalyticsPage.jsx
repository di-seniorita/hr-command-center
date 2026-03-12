import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchAnalytics, fetchChurnRisk } from "../api";

const pieColors = ["#818CF8", "#22D3EE", "#34D399", "#FBBF24", "#F87171"];

function churnColor(value) {
  if (value >= 0.7) return "text-red-400";
  if (value >= 0.4) return "text-yellow-300";
  return "text-green-400";
}

function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [churnRisk, setChurnRisk] = useState([]);

  useEffect(() => {
    const load = async () => {
      const [analyticsData, churnData] = await Promise.all([fetchAnalytics(), fetchChurnRisk()]);
      setAnalytics(analyticsData);
      setChurnRisk(churnData);
    };

    load();
  }, []);

  if (!analytics) {
    return <div className="text-gray-300">Загрузка аналитики...</div>;
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

      <div className="max-w-sm rounded-xl border border-gray-800 bg-gray-800 p-5">
        <p className="text-sm text-gray-400">Доля удаленных сотрудников</p>
        <p className="mt-2 text-4xl font-bold text-indigo-300">{analytics.remote_percentage}%</p>
      </div>
    </div>
  );
}

export default AnalyticsPage;
