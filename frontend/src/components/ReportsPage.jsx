import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { fetchReport } from "../api";

const reportsConfig = [
  { key: "salary-boxplot", title: "Распределение зарплат по отделам" },
  { key: "engagement-heatmap", title: "Тепловая карта вовлечённости" },
  { key: "churn-factors", title: "Факторы влияния на отток" },
  { key: "hiring-funnel", title: "Воронка найма" },
  { key: "remote-vs-office", title: "Вовлечённость: удалённые vs офис" },
];

function ReportsPage() {
  const [reportData, setReportData] = useState({});
  const [loadingMap, setLoadingMap] = useState({});

  const handleGenerate = async (reportKey) => {
    setLoadingMap((prev) => ({ ...prev, [reportKey]: true }));
    try {
      const data = await fetchReport(reportKey);
      setReportData((prev) => ({ ...prev, [reportKey]: data }));
      toast.success("Отчёт сгенерирован");
    } catch {
      toast.error("Не удалось сгенерировать отчёт");
    } finally {
      setLoadingMap((prev) => ({ ...prev, [reportKey]: false }));
    }
  };

  const handleDownload = (reportKey, title) => {
    const report = reportData[reportKey];
    if (!report?.image) {
      return;
    }

    const link = document.createElement("a");
    link.href = `data:image/png;base64,${report.image}`;
    link.download = `${title}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">HR Отчёты</h2>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {reportsConfig.map((report) => {
          const reportItem = reportData[report.key];
          const isLoading = Boolean(loadingMap[report.key]);

          return (
            <div
              key={report.key}
              className="rounded-xl border border-gray-800 bg-gray-800 p-4"
            >
              <h3 className="mb-3 text-lg font-semibold">{report.title}</h3>

              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleGenerate(report.key)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading && <Loader2 size={16} className="animate-spin" />}
                  Сгенерировать
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload(report.key, report.title)}
                  disabled={!reportItem?.image}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-200 transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download size={16} />
                  Скачать PNG
                </button>
              </div>

              <div className="min-h-36 rounded-lg border border-gray-700 bg-gray-900 p-3">
                {isLoading ? (
                  <div className="flex h-40 items-center justify-center text-gray-400">
                    <Loader2 className="animate-spin" size={22} />
                  </div>
                ) : reportItem?.image ? (
                  <img
                    src={`data:image/png;base64,${reportItem.image}`}
                    alt={reportItem.title || report.title}
                    className="w-full rounded-lg"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center text-sm text-gray-500">
                    Нажмите «Сгенерировать», чтобы построить отчёт
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ReportsPage;
