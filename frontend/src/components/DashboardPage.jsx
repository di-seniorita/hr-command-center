import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchAnalytics, fetchChurnRisk } from "../api";

const turnoverMock = [
  { month: "Окт", turnover: 7.2 },
  { month: "Ноя", turnover: 8.1 },
  { month: "Дек", turnover: 9.0 },
  { month: "Янв", turnover: 8.4 },
  { month: "Фев", turnover: 7.7 },
  { month: "Мар", turnover: 8.6 },
];

function riskColor(probability) {
  if (probability >= 0.7) return "text-red-400";
  if (probability >= 0.4) return "text-yellow-300";
  return "text-green-400";
}

function DashboardPage() {
  const [analytics, setAnalytics] = useState(null);
  const [churnRisk, setChurnRisk] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [analyticsData, churnData] = await Promise.all([fetchAnalytics(), fetchChurnRisk()]);
        setAnalytics(analyticsData);
        setChurnRisk(churnData.slice(0, 3));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const kpis = useMemo(() => {
    if (!analytics) return [];
    return [
      { label: "Всего сотрудников", value: analytics.total_employees },
      { label: "Сейчас на онбординге", value: analytics.onboarding_count },
      { label: "Средняя вовлеченность", value: analytics.average_engagement },
      { label: "Текучесть, %", value: analytics.turnover_rate },
    ];
  }, [analytics]);

  if (loading) {
    return <div className="text-gray-300">Загрузка дашборда...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Главный дашборд</h2>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-gray-800 bg-gray-800 p-4">
            <p className="text-sm text-gray-400">{kpi.label}</p>
            <p className="mt-2 text-3xl font-bold text-indigo-300">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
          <h3 className="mb-4 text-lg font-semibold">Вовлеченность по отделам</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.engagement_by_department || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="department" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip />
                <Bar dataKey="avg_engagement" fill="#818CF8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
          <h3 className="mb-4 text-lg font-semibold">Динамика текучести (6 месяцев)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={turnoverMock}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip />
                <Line type="monotone" dataKey="turnover" stroke="#F59E0B" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
        <h3 className="mb-4 text-lg font-semibold">Churn Risk (Top 3)</h3>
        <div className="space-y-3">
          {churnRisk.map((person) => (
            <div key={person.employee_id} className="flex items-center justify-between rounded-lg bg-gray-900 p-3">
              <div>
                <p className="font-medium">{person.name}</p>
                <p className="text-sm text-gray-400">{person.department} • Вовлеченность: {person.avg_engagement}</p>
              </div>
              <p className={`text-lg font-bold ${riskColor(person.churn_probability)}`}>
                {(person.churn_probability * 100).toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
