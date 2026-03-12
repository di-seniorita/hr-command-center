import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export const loginUser = async (username, password) => {
  const { data } = await api.post("/api/auth/login", { username, password });
  return data;
};

export const registerUser = async (payload) => {
  const { data } = await api.post("/api/auth/register", payload);
  return data;
};

export const fetchCurrentUser = async () => {
  const { data } = await api.get("/api/auth/me");
  return data;
};

export const fetchAnalytics = async () => {
  const { data } = await api.get("/api/analytics");
  return data;
};

export const fetchChurnRisk = async () => {
  const { data } = await api.get("/api/analytics/churn-risk");
  return data;
};

export const fetchTurnoverHistory = async () => {
  const { data } = await api.get("/api/analytics/turnover-history");
  return data;
};

export const fetchAlerts = async () => {
  const { data } = await api.get("/api/alerts");
  return data;
};

export const fetchCandidates = async () => {
  const { data } = await api.get("/api/candidates");
  return data;
};

export const createCandidate = async (payload) => {
  const { data } = await api.post("/api/candidates", payload);
  return data;
};

export const uploadResume = async (formData) => {
  const { data } = await api.post("/api/candidates/upload-resume", formData, {
    timeout: 30000,
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
};

export const updateCandidate = async (id, payload) => {
  const { data } = await api.put(`/api/candidates/${id}`, payload);
  return data;
};

export const rescoreCandidate = async (id) => {
  const { data } = await api.get(`/api/candidates/${id}/rescore`);
  return data;
};

export const fetchVacancies = async () => {
  const { data } = await api.get("/api/vacancies");
  return data;
};

export const fetchEmployees = async (params = {}) => {
  const { data } = await api.get("/api/employees", { params });
  return data;
};

export const fetchOnboardingTasks = async (employeeId) => {
  const { data } = await api.get(`/api/onboarding/${employeeId}/tasks`);
  return data;
};

export const updateOnboardingTask = async (employeeId, payload) => {
  const { data } = await api.put(`/api/onboarding/${employeeId}/tasks`, payload);
  return data;
};

export const createOnboardingTask = async (employeeId, payload) => {
  const { data } = await api.post(`/api/onboarding/${employeeId}/tasks`, payload);
  return data;
};

export const fetchTraining = async (status = "") => {
  const { data } = await api.get("/api/training", { params: status ? { status } : {} });
  return data;
};

export const fetchContracts = async () => {
  const { data } = await api.get("/api/contracts");
  return data;
};

export const createContract = async (payload) => {
  const { data } = await api.post("/api/contracts", payload);
  return data;
};

export const generateAct = async (id) => {
  const { data } = await api.post(`/api/contracts/${id}/generate-act`);
  return data;
};

export const checkAiHealth = async () => {
  const { data } = await api.get("/api/ai/health");
  return data;
};

export const summarizeCandidate = async (candidateId) => {
  const { data } = await api.post(
    "/api/ai/summarize",
    { candidate_id: candidateId },
    { timeout: 120000 },
  );
  return data;
};

export const compareCandidates = async (candidateIds, criteria) => {
  const { data } = await api.post(
    "/api/ai/compare",
    { candidate_ids: candidateIds, criteria },
    { timeout: 120000 },
  );
  return data;
};

export const customAiQuery = async (candidateIds, hrPrompt) => {
  const { data } = await api.post(
    "/api/ai/custom-query",
    { candidate_ids: candidateIds, hr_prompt: hrPrompt },
    { timeout: 120000 },
  );
  return data;
};

export const fetchReport = async (reportName) => {
  const { data } = await api.get(`/api/reports/${reportName}`);
  return data;
};

export default api;
