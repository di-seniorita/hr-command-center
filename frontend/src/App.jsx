import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bot,
  Brain,
  FileBarChart,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  ScrollText,
  UserCheck,
  Users,
} from "lucide-react";
import { Toaster } from "react-hot-toast";
import { fetchCurrentUser } from "./api";
import AiAssistantPage from "./components/AiAssistantPage";
import AnalyticsPage from "./components/AnalyticsPage";
import CandidatesPage from "./components/CandidatesPage";
import ChatbotPanel from "./components/ChatbotPanel";
import ContractsPage from "./components/ContractsPage";
import DashboardPage from "./components/DashboardPage";
import LoginPage from "./components/LoginPage";
import OnboardingPage from "./components/OnboardingPage";
import ReportsPage from "./components/ReportsPage";
import TrainingPage from "./components/TrainingPage";

const navItems = [
  { to: "/", label: "Дашборд", icon: LayoutDashboard },
  { to: "/candidates", label: "Кандидаты", icon: Users },
  { to: "/onboarding", label: "Онбординг", icon: UserCheck },
  { to: "/analytics", label: "Аналитика + AI", icon: Brain },
  { to: "/reports", label: "HR Отчёты", icon: FileBarChart },
  { to: "/ai-assistant", label: "AI Ассистент", icon: Bot },
  { to: "/training", label: "Обучение", icon: GraduationCap },
  { to: "/contracts", label: "Договоры ГПХ", icon: ScrollText },
];

function App() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token");
      const cachedUser = localStorage.getItem("user");

      if (!token) {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setIsCheckingAuth(false);
        return;
      }

      if (cachedUser) {
        try {
          setCurrentUser(JSON.parse(cachedUser));
        } catch {
          localStorage.removeItem("user");
        }
      }

      try {
        const me = await fetchCurrentUser();
        setCurrentUser(me);
        localStorage.setItem("user", JSON.stringify(me));
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setCurrentUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    navigate("/");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setCurrentUser(null);
    setIsAuthenticated(false);
    navigate("/login");
  };

  if (isCheckingAuth) {
    return <div className="min-h-screen bg-gray-900" />;
  }

  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="top-right" />
        <Routes>
          <Route path="*" element={<LoginPage onAuthSuccess={handleAuthSuccess} />} />
        </Routes>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Toaster position="top-right" />
      <div className="flex min-h-screen">
        <aside className="flex w-72 flex-col border-r border-gray-800 bg-gray-950 p-5">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-lg bg-indigo-500/20 p-2 text-indigo-300">
              <BarChart3 size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold">HR Command Center</h1>
              <p className="text-xs text-gray-400">Управление персоналом и AI</p>
            </div>
          </div>

          <div className="mb-5 rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2 text-sm">
            <p className="text-gray-400">Текущий пользователь</p>
            <p className="font-medium text-gray-100">{currentUser?.full_name || currentUser?.username}</p>
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

          <button
            type="button"
            onClick={handleLogout}
            className="mt-auto flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-800 hover:text-white"
          >
            <LogOut size={16} />
            Выйти
          </button>
        </aside>

        <main className="flex-1 p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/candidates" element={<CandidatesPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/ai-assistant" element={<AiAssistantPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/contracts" element={<ContractsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <ChatbotPanel />
      </div>
    </div>
  );
}

export default App;
