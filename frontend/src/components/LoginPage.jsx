import { useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { loginUser, registerUser } from "../api";

const initialRegisterForm = {
  username: "",
  email: "",
  full_name: "",
  password: "",
};

function LoginPage({ onAuthSuccess }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await loginUser(loginForm.username, loginForm.password);
      localStorage.setItem("token", response.access_token);
      localStorage.setItem("user", JSON.stringify(response.user));
      toast.success("Вход выполнен успешно");
      onAuthSuccess(response.user);
    } catch (error) {
      setErrorMessage(error.response?.data?.detail || "Неверный логин или пароль");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await registerUser(registerForm);
      localStorage.setItem("token", response.access_token);
      localStorage.setItem("user", JSON.stringify(response.user));
      toast.success("Регистрация выполнена успешно");
      onAuthSuccess(response.user);
    } catch (error) {
      setErrorMessage(error.response?.data?.detail || "Ошибка регистрации");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4 text-gray-100">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-800 p-6 shadow-xl">
        <h1 className="text-center text-2xl font-bold">HR Command Center</h1>
        <p className="mt-2 text-center text-sm text-gray-400">
          {isRegisterMode ? "Создание аккаунта HR" : "Вход в рабочее пространство"}
        </p>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        {!isRegisterMode ? (
          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <label className="block space-y-1 text-sm">
              <span className="text-gray-300">Логин</span>
              <input
                required
                value={loginForm.username}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, username: event.target.value }))}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 focus:border-indigo-400 focus:outline-none"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-gray-300">Пароль</span>
              <input
                required
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 focus:border-indigo-400 focus:outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              Войти
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleRegister}>
            <label className="block space-y-1 text-sm">
              <span className="text-gray-300">Логин</span>
              <input
                required
                value={registerForm.username}
                onChange={(event) =>
                  setRegisterForm((prev) => ({ ...prev, username: event.target.value }))
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 focus:border-indigo-400 focus:outline-none"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-gray-300">Email</span>
              <input
                required
                type="email"
                value={registerForm.email}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 focus:border-indigo-400 focus:outline-none"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-gray-300">ФИО</span>
              <input
                required
                value={registerForm.full_name}
                onChange={(event) =>
                  setRegisterForm((prev) => ({ ...prev, full_name: event.target.value }))
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 focus:border-indigo-400 focus:outline-none"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-gray-300">Пароль</span>
              <input
                required
                type="password"
                value={registerForm.password}
                onChange={(event) =>
                  setRegisterForm((prev) => ({ ...prev, password: event.target.value }))
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 focus:border-indigo-400 focus:outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              Зарегистрироваться
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => {
            setErrorMessage("");
            setIsRegisterMode((prev) => !prev);
          }}
          className="mt-5 w-full text-sm text-indigo-300 transition hover:text-indigo-200"
        >
          {isRegisterMode ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
        </button>
      </div>
    </div>
  );
}

export default LoginPage;
