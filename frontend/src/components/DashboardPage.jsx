import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchAlerts, fetchAnalytics, fetchChurnRisk, fetchTurnoverHistory } from "../api";

function riskColor(probability) {
  if (probability >= 0.7) return "text-red-400";
  if (probability >= 0.4) return "text-yellow-300";
  return "text-green-400";
}

function DashboardPage() {
  const [analytics, setAnalytics] = useState(null);
  const [churnRisk, setChurnRisk] = useState([]);
  const [turnoverHistory, setTurnoverHistory] = useState([]);
  const [alerts, setAlerts] = useState({
    candidates_waiting: [],
    high_churn_risk: [],
    overdue_onboarding: [],
  });
  const [expandedAlerts, setExpandedAlerts] = useState({
    candidates: false,
    churn: false,
    onboarding: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [analyticsData, churnData, turnoverData, alertsData] = await Promise.all([
          fetchAnalytics(),
          fetchChurnRisk(),
          fetchTurnoverHistory(),
          fetchAlerts(),
        ]);
        setAnalytics(analyticsData);
        setChurnRisk(churnData.slice(0, 3));
        setTurnoverHistory(turnoverData);
        setAlerts(alertsData);
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

  const toggleAlertSection = (key) => {
    setExpandedAlerts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-72 rounded-lg bg-gray-800 animate-pulse" />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`dashboard-kpi-skeleton-${index}`}
              className="h-24 rounded-xl bg-gray-800 animate-pulse"
            />
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-80 rounded-xl bg-gray-800 animate-pulse" />
          <div className="h-80 rounded-xl bg-gray-800 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Главный дашборд</h2>

      <div className="rounded-xl border border-orange-500/30 bg-gradient-to-r from-red-500/15 to-orange-500/10 p-4">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={18} className="text-orange-300" />
          <h3 className="text-lg font-semibold text-orange-200">Оповещения</h3>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => toggleAlertSection("candidates")}
            className="flex w-full items-center justify-between rounded-lg bg-gray-900/50 px-3 py-2 text-left hover:bg-gray-900"
          >
            <span className="text-sm text-orange-100">
              {alerts.candidates_waiting.length} кандидатов ждут ответа
            </span>
            {expandedAlerts.candidates ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandedAlerts.candidates && (
            <div className="rounded-lg bg-gray-900/50 p-3">
              {alerts.candidates_waiting.length === 0 ? (
                <p className="text-sm text-gray-400">Просроченных кандидатов нет</p>
              ) : (
                <ul className="space-y-1 text-sm text-gray-200">
                  {alerts.candidates_waiting.map((candidate) => (
                    <li key={candidate.id}>
                      {candidate.name} — {candidate.vacancy_title} ({candidate.days_waiting} дн.)
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => toggleAlertSection("churn")}
            className="flex w-full items-center justify-between rounded-lg bg-gray-900/50 px-3 py-2 text-left hover:bg-gray-900"
          >
            <span className="text-sm text-orange-100">
              {alerts.high_churn_risk.length} сотрудников в зоне риска
            </span>
            {expandedAlerts.churn ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandedAlerts.churn && (
            <div className="rounded-lg bg-gray-900/50 p-3">
              {alerts.high_churn_risk.length === 0 ? (
                <p className="text-sm text-gray-400">Критического риска оттока не обнаружено</p>
              ) : (
                <ul className="space-y-1 text-sm text-gray-200">
                  {alerts.high_churn_risk.map((employee) => (
                    <li key={employee.id}>
                      {employee.name} — {employee.department} ({(employee.churn_probability * 100).toFixed(1)}%)
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => toggleAlertSection("onboarding")}
            className="flex w-full items-center justify-between rounded-lg bg-gray-900/50 px-3 py-2 text-left hover:bg-gray-900"
          >
            <span className="text-sm text-orange-100">
              {alerts.overdue_onboarding.length} просроченных задач онбординга
            </span>
            {expandedAlerts.onboarding ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expandedAlerts.onboarding && (
            <div className="rounded-lg bg-gray-900/50 p-3">
              {alerts.overdue_onboarding.length === 0 ? (
                <p className="text-sm text-gray-400">Просроченных задач нет</p>
              ) : (
                <ul className="space-y-1 text-sm text-gray-200">
                  {alerts.overdue_onboarding.map((task) => (
                    <li key={task.id}>
                      {task.title} — {task.employee_name} (срок: {task.due_date})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

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
              <LineChart data={turnoverHistory}>
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
