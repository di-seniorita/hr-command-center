import { NavLink, Route, Routes } from "react-router-dom";
import {
  BarChart3,
  Brain,
  GraduationCap,
  LayoutDashboard,
  ScrollText,
  UserCheck,
  Users,
} from "lucide-react";
import DashboardPage from "./components/DashboardPage";
import CandidatesPage from "./components/CandidatesPage";
import OnboardingPage from "./components/OnboardingPage";
import AnalyticsPage from "./components/AnalyticsPage";
import TrainingPage from "./components/TrainingPage";
import ContractsPage from "./components/ContractsPage";

const navItems = [
  { to: "/", label: "Дашборд", icon: LayoutDashboard },
  { to: "/candidates", label: "Кандидаты", icon: Users },
  { to: "/onboarding", label: "Онбординг", icon: UserCheck },
  { to: "/analytics", label: "Аналитика + AI", icon: Brain },
  { to: "/training", label: "Обучение", icon: GraduationCap },
  { to: "/contracts", label: "Договоры ГПХ", icon: ScrollText },
];

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-gray-800 bg-gray-950 p-5">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-lg bg-indigo-500/20 p-2 text-indigo-300">
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold">HR Command Center</h1>
              <p className="text-xs text-gray-400">Управление персоналом и AI</p>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition ${
                      isActive
                        ? "bg-indigo-500/20 text-indigo-200"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white"
                    }`
                  }
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/candidates" element={<CandidatesPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/contracts" element={<ContractsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
