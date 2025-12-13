import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

/* --------------------------- Backend status hook -------------------------- */
function useBackendStatus() {
  const [status, setStatus] = useState({ loading: true, ok: false });

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (!res.ok) throw new Error("HTTP error");
        const data = await res.json();
        setStatus({ loading: false, ok: true, data });
      } catch (err) {
        console.error("Erro ao falar com backend:", err);
        setStatus({ loading: false, ok: false });
      }
    }
    check();
  }, []);

  return status;
}

/* ----------------------------- Helpers (BRL) ------------------------------ */
function fmtBRL(value) {
  if (value === null || value === undefined) return "-";
  const n =
    typeof value === "string"
      ? Number(value.toString().replace(",", "."))
      : Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ------------------------- FORM CLIENTE + ORDEM --------------------------- */
function ClientOrderForm() {
  const [client, setClient] = useState({
    cpfCnpj: "",
    nomeRazaoSocial: "",
    email: "",
    telefone: "",
  });

  const [order, setOrder] = useState({
    descricao: "",
    tipoContrato: "",
    valorTotalPrevisto: "",
    modeloPagamento: "AVISTA",
    dataInicio: "",
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleClientChange = (e) => {
    const { name, value } = e.target;
    setClient((prev) => ({ ...prev, [name]: value }));
  };

  const handleOrderChange = (e) => {
    const { name, value } = e.target;
    setOrder((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        client,
        order: {
          ...order,
          valorTotalPrevisto: order.valorTotalPrevisto
            ? Number(order.valorTotalPrevisto.toString().replace(",", "."))
            : null,
        },
      };

      const res = await fetch(`${API_BASE}/api/clients-and-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Erro ao criar cliente + ordem");
      }

      const data = await res.json();
      setResult(data);

      setClient({ cpfCnpj: "", nomeRazaoSocial: "", email: "", telefone: "" });
      setOrder({
        descricao: "",
        tipoContrato: "",
        valorTotalPrevisto: "",
        modeloPagamento: "AVISTA",
        dataInicio: "",
      });
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm" onSubmit={handleSubmit}>
      <div>
        <h4 className="font-semibold mb-2">Dados do cliente</h4>
        <div className="space-y-2">
          <input
            type="text"
            name="cpfCnpj"
            placeholder="CPF/CNPJ"
            value={client.cpfCnpj}
            onChange={handleClientChange}
            className="w-full border rounded px-2 py-1"
            required
          />
          <input
            type="text"
            name="nomeRazaoSocial"
            placeholder="Nome / Razão Social"
            value={client.nomeRazaoSocial}
            onChange={handleClientChange}
            className="w-full border rounded px-2 py-1"
            required
          />
          <input
            type="email"
            name="email"
            placeholder="E-mail"
            value={client.email}
            onChange={handleClientChange}
            className="w-full border rounded px-2 py-1"
          />
          <input
            type="text"
            name="telefone"
            placeholder="Telefone"
            value={client.telefone}
            onChange={handleClientChange}
            className="w-full border rounded px-2 py-1"
          />
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Dados da ordem de pagamento</h4>
        <div className="space-y-2">
          <input
            type="text"
            name="descricao"
            placeholder="Descrição / Objeto"
            value={order.descricao}
            onChange={handleOrderChange}
            className="w-full border rounded px-2 py-1"
          />
          <input
            type="text"
            name="tipoContrato"
            placeholder="Tipo de contrato"
            value={order.tipoContrato}
            onChange={handleOrderChange}
            className="w-full border rounded px-2 py-1"
          />
          <input
            type="text"
            name="valorTotalPrevisto"
            placeholder="Valor total previsto"
            value={order.valorTotalPrevisto}
            onChange={handleOrderChange}
            className="w-full border rounded px-2 py-1"
          />
          <select
            name="modeloPagamento"
            value={order.modeloPagamento}
            onChange={handleOrderChange}
            className="w-full border rounded px-2 py-1"
          >
            <option value="AVISTA">À vista</option>
            <option value="ENTRADA_E_PARCELAS">Entrada + parcelas</option>
            <option value="PARCELAS">Somente parcelas</option>
          </select>
          <input
            type="date"
            name="dataInicio"
            value={order.dataInicio}
            onChange={handleOrderChange}
            className="w-full border rounded px-2 py-1"
            required
          />
        </div>
      </div>

      <div className="md:col-span-2 flex gap-4 items-center">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded bg-slate-900 text-white disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Salvar cliente + ordem"}
        </button>

        {error && <span className="text-xs text-red-600">{error}</span>}
        {result && (
          <span className="text-xs text-green-700">
            Criado! Cliente #{result.cliente.id}, Ordem #{result.ordem.id} (sequência{" "}
            {result.ordem.sequenciaCliente})
          </span>
        )}
      </div>
    </form>
  );
}

/* ------------------------- LISTAGEM CLIENTES + ORDENS --------------------- */
function ClientsOrdersList() {
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    fromDate: "",
    toDate: "",
  });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.search) params.append("search", filters.search);
      if (filters.status) params.append("status", filters.status);
      if (filters.fromDate) params.append("fromDate", filters.fromDate);
      if (filters.toDate) params.append("toDate", filters.toDate);

      const res = await fetch(`${API_BASE}/api/clients-with-orders?${params.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar listagem");
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleApply = (e) => {
    e.preventDefault();
    load();
  };

  return (
    <div className="text-sm">
      <form className="flex flex-wrap gap-3 mb-4 items-end" onSubmit={handleApply}>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Cliente / CPF/CNPJ</label>
          <input
            type="text"
            name="search"
            value={filters.search}
            onChange={handleChange}
            className="border rounded px-2 py-1"
            placeholder="Digite parte do nome ou CPF/CNPJ"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1">Status da ordem</label>
          <select
            name="status"
            value={filters.status}
            onChange={handleChange}
            className="border rounded px-2 py-1"
          >
            <option value="">Todos</option>
            <option value="ATIVA">Ativa</option>
            <option value="CONCLUIDA">Concluída</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1">Início a partir de</label>
          <input
            type="date"
            name="fromDate"
            value={filters.fromDate}
            onChange={handleChange}
            className="border rounded px-2 py-1"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1">Início até</label>
          <input
            type="date"
            name="toDate"
            value={filters.toDate}
            onChange={handleChange}
            className="border rounded px-2 py-1"
          />
        </div>

        <button type="submit" className="px-3 py-1 rounded bg-slate-900 text-white text-xs">
          Aplicar filtros
        </button>
      </form>

      {loading && <p>Carregando...</p>}
      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}

      <div className="border rounded bg-white max-h-[60vh] overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-slate-100">
            <tr>
              <th className="border px-2 py-1 text-left">Cliente</th>
              <th className="border px-2 py-1 text-left">CPF/CNPJ</th>
              <th className="border px-2 py-1 text-center">Ordens</th>
              <th className="border px-2 py-1 text-left">Detalhes</th>
            </tr>
          </thead>

          <tbody>
            {data.map((cli) => (
              <tr key={cli.id}>
                <td className="border px-2 py-1 align-top">{cli.nomeRazaoSocial}</td>
                <td className="border px-2 py-1 align-top">{cli.cpfCnpj}</td>
                <td className="border px-2 py-1 align-top text-center">{cli.ordens?.length || 0}</td>
                <td className="border px-2 py-1">
                  {cli.ordens?.length ? (
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="border px-1 py-0.5 text-left">Seq.</th>
                          <th className="border px-1 py-0.5 text-left">Descrição</th>
                          <th className="border px-1 py-0.5 text-left">Tipo</th>
                          <th className="border px-1 py-0.5 text-right">Valor Prev.</th>
                          <th className="border px-1 py-0.5 text-center">Modelo</th>
                          <th className="border px-1 py-0.5 text-center">Status</th>
                          <th className="border px-1 py-0.5 text-center">Início</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cli.ordens.map((ord) => (
                          <tr key={ord.id}>
                            <td className="border px-1 py-0.5">{ord.sequenciaCliente}</td>
                            <td className="border px-1 py-0.5">{ord.descricao || "-"}</td>
                            <td className="border px-1 py-0.5">{ord.tipoContrato || "-"}</td>
                            <td className="border px-1 py-0.5 text-right">{fmtBRL(ord.valorTotalPrevisto)}</td>
                            <td className="border px-1 py-0.5 text-center">{ord.modeloPagamento}</td>
                            <td className="border px-1 py-0.5 text-center">{ord.status}</td>
                            <td className="border px-1 py-0.5 text-center">
                              {ord.dataInicio ? new Date(ord.dataInicio).toLocaleDateString("pt-BR") : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <span className="text-slate-400">Nenhuma ordem encontrada.</span>
                  )}
                </td>
              </tr>
            ))}

            {!loading && !data.length && (
              <tr>
                <td colSpan={4} className="border px-2 py-2 text-center text-slate-400">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------ DASHBOARD VIEW ---------------------------- */
function DashboardView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/dashboard/summary`);
        if (!res.ok) throw new Error("Erro ao carregar dashboard");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <p className="text-sm">Carregando dashboard...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded p-3">
          <p className="text-xs text-slate-500">Clientes cadastrados</p>
          <p className="text-2xl font-semibold">{data.totalClients}</p>
        </div>

        <div className="bg-white border rounded p-3">
          <p className="text-xs text-slate-500">Ordens de pagamento</p>
          <p className="text-2xl font-semibold">{data.totalOrders}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Ativas: {data.totalAtivas} • Concluídas: {data.totalConcluidas}
          </p>
        </div>

        <div className="bg-white border rounded p-3">
          <p className="text-xs text-slate-500">Valor total previsto</p>
          <p className="text-2xl font-semibold">{fmtBRL(data.totalValorPrevisto)}</p>
        </div>

        <div className="bg-white border rounded p-3">
          <p className="text-xs text-slate-500">API base</p>
          <p className="text-[11px] break-all">{API_BASE}</p>
        </div>
      </div>

      <div className="bg-white border rounded p-3">
        <p className="text-xs text-slate-500">
          (Por enquanto o dashboard reflete “previstos” por ordens. Entradas reais virão com a tabela Pagamento.)
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------- APP ---------------------------------- */
export default function App() {
  const backend = useBackendStatus();
  const [view, setView] = useState("create"); // create | list | dashboard

  const backendLabel = backend.loading ? "verificando..." : backend.ok ? "ok" : "erro";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="w-full border-b bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Controles-AMR</h1>
          <p className="text-sm text-slate-500">
            Controle de recebimentos, repasses e obrigações internas – AMR Advogados
          </p>
        </div>
        <div className="text-sm">
          <span className="text-slate-500 mr-2">Backend:</span>
          <span
            className={
              backendLabel === "ok"
                ? "text-green-600 font-semibold"
                : backendLabel === "erro"
                ? "text-red-600 font-semibold"
                : "text-slate-500"
            }
          >
            {backendLabel}
          </span>
        </div>
      </header>

      <main className="flex">
        <aside className="w-80 border-r bg-white px-6 py-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Módulos</h2>

          <nav className="space-y-1 text-sm">
            <button
              className={`block w-full text-left px-2 py-1 rounded ${
                view === "create" ? "bg-slate-900 text-white" : "hover:bg-slate-100 text-slate-800"
              }`}
              onClick={() => setView("create")}
            >
              Cadastro rápido (Cliente + Ordem)
            </button>

            <button
              className={`block w-full text-left px-2 py-1 rounded ${
                view === "list" ? "bg-slate-900 text-white" : "hover:bg-slate-100 text-slate-800"
              }`}
              onClick={() => setView("list")}
            >
              Listagem (Clientes & Ordens)
            </button>

            <button
              className={`block w-full text-left px-2 py-1 rounded ${
                view === "dashboard"
                  ? "bg-slate-900 text-white"
                  : "hover:bg-slate-100 text-slate-800"
              }`}
              onClick={() => setView("dashboard")}
            >
              Dashboard financeiro
            </button>
          </nav>
        </aside>

        <section className="flex-1 px-8 py-8">
          {view === "create" && (
            <>
              <h2 className="text-lg font-semibold mb-4">Cadastro rápido: Cliente + Ordem</h2>
              <ClientOrderForm />
              <div className="mt-6 text-xs text-slate-500">
                API base utilizada: <code>{API_BASE}</code>
              </div>
            </>
          )}

          {view === "list" && (
            <>
              <h2 className="text-lg font-semibold mb-4">Listagem de Clientes & Ordens</h2>
              <ClientsOrdersList />
            </>
          )}

          {view === "dashboard" && (
            <>
              <h2 className="text-lg font-semibold mb-4">Dashboard financeiro</h2>
              <DashboardView />
            </>
          )}
        </section>
      </main>
    </div>
  );
}
