import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createContract, fetchContracts, generateAct } from "../api";

const contractStatuses = ["draft", "approved", "signed"];

const statusLabels = {
  draft: "Черновик",
  approved: "Согласован",
  signed: "Подписан",
};

const statusBadgeClass = {
  draft: "bg-yellow-500/20 text-yellow-300",
  approved: "bg-blue-500/20 text-blue-300",
  signed: "bg-green-500/20 text-green-300",
};

const initialForm = {
  contractor_name: "",
  contract_number: "",
  month: "",
  hours_worked: "",
  hourly_rate: "",
  status: "draft",
  jira_tasks_text: "",
};

function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [actPreview, setActPreview] = useState(null);

  const loadContracts = async () => {
    setLoading(true);
    try {
      const data = await fetchContracts();
      setContracts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
  }, []);

  const handleCreateContract = async (event) => {
    event.preventDefault();

    const payload = {
      contractor_name: form.contractor_name,
      contract_number: form.contract_number,
      month: form.month,
      hours_worked: Number(form.hours_worked),
      hourly_rate: Number(form.hourly_rate),
      status: form.status,
      jira_tasks: form.jira_tasks_text
        .split(",")
        .map((task) => task.trim())
        .filter(Boolean),
    };

    await createContract(payload);
    toast.success("Договор добавлен");
    setForm(initialForm);
    await loadContracts();
  };

  const handleGenerateAct = async (contractId) => {
    const data = await generateAct(contractId);
    setActPreview(data);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-56 rounded-lg bg-gray-800 animate-pulse" />
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`contracts-skeleton-${index}`} className="grid grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((__, cellIndex) => (
                  <div
                    key={`contracts-skeleton-${index}-${cellIndex}`}
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
      <h2 className="text-2xl font-bold">Договоры ГПХ</h2>

      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-800">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-900/70">
            <tr>
              <th className="table-header-cell">Подрядчик</th>
              <th className="table-header-cell">Номер договора</th>
              <th className="table-header-cell">Месяц</th>
              <th className="table-header-cell">Сумма</th>
              <th className="table-header-cell">Статус</th>
              <th className="table-header-cell">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {contracts.map((contract) => (
              <tr key={contract.id} className="hover:bg-gray-700/30">
                <td className="table-cell">{contract.contractor_name}</td>
                <td className="table-cell">{contract.contract_number}</td>
                <td className="table-cell">{contract.month}</td>
                <td className="table-cell">{contract.total_amount.toLocaleString("ru-RU")} ₽</td>
                <td className="table-cell">
                  <span className={`rounded-full px-3 py-1 text-xs ${statusBadgeClass[contract.status]}`}>
                    {statusLabels[contract.status]}
                  </span>
                </td>
                <td className="table-cell">
                  <button
                    onClick={() => handleGenerateAct(contract.id)}
                    className="rounded-md bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-400"
                  >
                    Сформировать акт
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
        <h3 className="mb-4 text-lg font-semibold">Добавить договор</h3>
        <form onSubmit={handleCreateContract} className="grid gap-4 md:grid-cols-2">
          <input
            required
            placeholder="Подрядчик"
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
            value={form.contractor_name}
            onChange={(e) => setForm((prev) => ({ ...prev, contractor_name: e.target.value }))}
          />
          <input
            required
            placeholder="Номер договора"
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
            value={form.contract_number}
            onChange={(e) => setForm((prev) => ({ ...prev, contract_number: e.target.value }))}
          />
          <input
            required
            placeholder="Месяц (например, 2026-04)"
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
            value={form.month}
            onChange={(e) => setForm((prev) => ({ ...prev, month: e.target.value }))}
          />
          <select
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
          >
            {contractStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
          <input
            required
            type="number"
            min="1"
            step="1"
            placeholder="Часы"
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
            value={form.hours_worked}
            onChange={(e) => setForm((prev) => ({ ...prev, hours_worked: e.target.value }))}
          />
          <input
            required
            type="number"
            min="1"
            step="1"
            placeholder="Ставка за час"
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2"
            value={form.hourly_rate}
            onChange={(e) => setForm((prev) => ({ ...prev, hourly_rate: e.target.value }))}
          />
          <textarea
            required
            rows={3}
            placeholder="Jira задачи через запятую"
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 md:col-span-2"
            value={form.jira_tasks_text}
            onChange={(e) => setForm((prev) => ({ ...prev, jira_tasks_text: e.target.value }))}
          />
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-400"
            >
              Добавить договор
            </button>
          </div>
        </form>
      </div>

      {actPreview && (
        <div className="rounded-xl border border-gray-800 bg-gray-800 p-4">
          <h3 className="mb-4 text-lg font-semibold">Предпросмотр акта</h3>
          <div className="grid gap-2 text-sm text-gray-200 md:grid-cols-2">
            <p>
              <span className="text-gray-400">Номер акта:</span> {actPreview.act_number}
            </p>
            <p>
              <span className="text-gray-400">Дата формирования:</span> {actPreview.generated_at}
            </p>
            <p>
              <span className="text-gray-400">Подрядчик:</span> {actPreview.contractor_name}
            </p>
            <p>
              <span className="text-gray-400">Договор:</span> {actPreview.contract_number}
            </p>
            <p>
              <span className="text-gray-400">Месяц:</span> {actPreview.month}
            </p>
            <p>
              <span className="text-gray-400">Часы:</span> {actPreview.hours_worked}
            </p>
            <p>
              <span className="text-gray-400">Ставка:</span> {actPreview.hourly_rate} ₽
            </p>
            <p>
              <span className="text-gray-400">Итог:</span> {actPreview.total_amount.toLocaleString("ru-RU")} ₽
            </p>
            <p className="md:col-span-2">
              <span className="text-gray-400">Jira задачи:</span> {actPreview.jira_tasks.join(", ")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContractsPage;
