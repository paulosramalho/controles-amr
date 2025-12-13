import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Alterando para testar deploy

/* --------------------------------- Helpers -------------------------------- */
function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function fmtBRL(value) {
  if (value === null || value === undefined) return "—";
  const n =
    typeof value === "string"
      ? Number(value.toString().replace(",", "."))
      : Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDateBR(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone] || tones.slate
      )}
    >
      {children}
    </span>
  );
}

function Card({ title, subtitle, children, right }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      {(title || subtitle || right) && (
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-slate-700">{label}</span>}
      <input
        {...props}
        className={cx(
          "w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none",
          "placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200",
          props.className
        )}
      />
    </label>
  );
}

function Select({ label, children, ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-slate-700">{label}</span>}
      <select
        {...props}
        className={cx(
          "w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none",
          "focus:border-slate-400 focus:ring-2 focus:ring-slate-200",
          props.className
        )}
      >
        {children}
      </select>
    </label>
  );
}

function Button({ variant = "primary", ...props }) {
  const variants = {
    primary:
      "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-200 border-slate-900",
    ghost:
      "bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-200 border-slate-200",
  };
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium shadow-sm",
        "outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant] || variants.primary,
        props.className
      )}
    />
  );
}

/* --------------------------- Backend status hook --------------------------- */
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
        setStatus({ loading: false, ok: false });
      }
    }
    check();
  }, []);

  return status;
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="Cadastro rápido"
      subtitle="Crie um Cliente e uma Ordem de Pagamento em uma única ação."
      right={
        <Badge tone="blue">
          API <span className="font-mono">{API_BASE.replace(/^https?:\/\//, "")}</span>
        </Badge>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border bg-slate-50/40 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Cliente</h4>
            <p className="mt-1 text-xs text-slate-500">
              Dados principais para identificação e contato.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <Input
                label="CPF/CNPJ"
                name="cpfCnpj"
                placeholder="Ex.: 111.222.333-44"
                value={client.cpfCnpj}
                onChange={handleClientChange}
                required
              />
              <Input
                label="Nome / Razão Social"
                name="nomeRazaoSocial"
                placeholder="Ex.: Empresa X Ltda."
                value={client.nomeRazaoSocial}
                onChange={handleClientChange}
                required
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="E-mail"
                  name="email"
                  type="email"
                  placeholder="financeiro@empresa.com"
                  value={client.email}
                  onChange={handleClientChange}
                />
                <Input
                  label="Telefone"
                  name="telefone"
                  placeholder="(99) 9 9999-9999"
                  value={client.telefone}
                  onChange={handleClientChange}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-slate-50/40 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Ordem de Pagamento</h4>
            <p className="mt-1 text-xs text-slate-500">
              Detalhes do contrato/ocorrência vinculada ao cliente.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <Input
                label="Descrição / Objeto"
                name="descricao"
                placeholder="Ex.: Contrato consultivo mensal"
                value={order.descricao}
                onChange={handleOrderChange}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Tipo de contrato"
                  name="tipoContrato"
                  placeholder="Ex.: esporádico, recorrente..."
                  value={order.tipoContrato}
                  onChange={handleOrderChange}
                />
                <Input
                  label="Valor total previsto"
                  name="valorTotalPrevisto"
                  placeholder="Ex.: 10000"
                  value={order.valorTotalPrevisto}
                  onChange={handleOrderChange}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  label="Modelo de pagamento"
                  name="modeloPagamento"
                  value={order.modeloPagamento}
                  onChange={handleOrderChange}
                >
                  <option value="AVISTA">À vista</option>
                  <option value="ENTRADA_E_PARCELAS">Entrada + parcelas</option>
                  <option value="PARCELAS">Somente parcelas</option>
                </Select>
                <Input
                  label="Data de início"
                  type="date"
                  name="dataInicio"
                  value={order.dataInicio}
                  onChange={handleOrderChange}
                  required
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Salvar cliente + ordem"}
          </Button>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
              Criado! Cliente <b>#{result.cliente.id}</b> • Ordem <b>#{result.ordem.id}</b> • Sequência{" "}
              <b>{result.ordem.sequenciaCliente}</b>
            </div>
          )}
        </div>
      </form>
    </Card>
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

  const hasFilters = useMemo(() => {
    return Boolean(filters.search || filters.status || filters.fromDate || filters.toDate);
  }, [filters]);

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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearFilters = () => {
    setFilters({ search: "", status: "", fromDate: "", toDate: "" });
    // recarrega sem filtro
    setTimeout(() => load(), 0);
  };

  const statusTone = (s) => {
    if (s === "ATIVA") return "green";
    if (s === "CONCLUIDA") return "slate";
    return "amber";
  };

  const modeloTone = (m) => {
    if (m === "AVISTA") return "violet";
    if (m === "ENTRADA_E_PARCELAS") return "blue";
    return "amber";
  };

  return (
    <div className="space-y-4">
      <Card
        title="Filtros"
        subtitle="Busque por cliente/CPF-CNPJ e refine por status e período."
        right={
          <div className="flex items-center gap-2">
            {hasFilters && <Badge tone="amber">Filtros ativos</Badge>}
            <Button variant="ghost" type="button" onClick={clearFilters}>
              Limpar
            </Button>
            <Button type="button" onClick={load} disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar"}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            label="Cliente / CPF-CNPJ"
            value={filters.search}
            onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
            placeholder="Digite parte do nome ou do CPF/CNPJ"
          />
          <Select
            label="Status"
            value={filters.status}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          >
            <option value="">Todos</option>
            <option value="ATIVA">Ativa</option>
            <option value="CONCLUIDA">Concluída</option>
          </Select>
          <Input
            label="Início (de)"
            type="date"
            value={filters.fromDate}
            onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))}
          />
          <Input
            label="Início (até)"
            type="date"
            value={filters.toDate}
            onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))}
          />
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
      </Card>

      <Card
        title="Clientes e ordens"
        subtitle="Listagem com detalhes por cliente."
        right={<Badge tone="slate">{data.length} cliente(s)</Badge>}
      >
        <div className="overflow-auto rounded-2xl border">
          <table className="min-w-[980px] w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100">
              <tr>
                <th className="border-b px-3 py-2 text-left">Cliente</th>
                <th className="border-b px-3 py-2 text-left">CPF/CNPJ</th>
                <th className="border-b px-3 py-2 text-center">Ordens</th>
                <th className="border-b px-3 py-2 text-left">Ordens (detalhes)</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    Carregando...
                  </td>
                </tr>
              )}

              {!loading && data.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-slate-500">
                    Nada por aqui. Tente ajustar filtros ou cadastre um cliente/ordem.
                  </td>
                </tr>
              )}

              {!loading &&
                data.map((cli, idx) => (
                  <tr key={cli.id} className={idx % 2 ? "bg-slate-50/50" : "bg-white"}>
                    <td className="border-b px-3 py-3 align-top">
                      <div className="font-medium text-slate-900">{cli.nomeRazaoSocial}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {cli.email && <Badge tone="slate">{cli.email}</Badge>}
                        {cli.telefone && <Badge tone="slate">{cli.telefone}</Badge>}
                        {cli.ativo ? <Badge tone="green">Ativo</Badge> : <Badge tone="red">Inativo</Badge>}
                      </div>
                    </td>

                    <td className="border-b px-3 py-3 align-top font-mono text-[11px] text-slate-700">
                      {cli.cpfCnpj}
                    </td>

                    <td className="border-b px-3 py-3 align-top text-center">
                      <Badge tone="blue">{cli.ordens?.length || 0}</Badge>
                    </td>

                    <td className="border-b px-3 py-3 align-top">
                      {cli.ordens?.length ? (
                        <div className="overflow-auto rounded-xl border bg-white">
                          <table className="min-w-[720px] w-full border-collapse text-[11px]">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="border-b px-2 py-1 text-left">Seq.</th>
                                <th className="border-b px-2 py-1 text-left">Descrição</th>
                                <th className="border-b px-2 py-1 text-left">Tipo</th>
                                <th className="border-b px-2 py-1 text-right">Previsto</th>
                                <th className="border-b px-2 py-1 text-center">Modelo</th>
                                <th className="border-b px-2 py-1 text-center">Status</th>
                                <th className="border-b px-2 py-1 text-center">Início</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cli.ordens.map((ord, j) => (
                                <tr key={ord.id} className={j % 2 ? "bg-slate-50/40" : "bg-white"}>
                                  <td className="border-b px-2 py-1">{ord.sequenciaCliente}</td>
                                  <td className="border-b px-2 py-1">{ord.descricao || "—"}</td>
                                  <td className="border-b px-2 py-1">{ord.tipoContrato || "—"}</td>
                                  <td className="border-b px-2 py-1 text-right">{fmtBRL(ord.valorTotalPrevisto)}</td>
                                  <td className="border-b px-2 py-1 text-center">
                                    <Badge tone={modeloTone(ord.modeloPagamento)}>{ord.modeloPagamento}</Badge>
                                  </td>
                                  <td className="border-b px-2 py-1 text-center">
                                    <Badge tone={statusTone(ord.status)}>{ord.status}</Badge>
                                  </td>
                                  <td className="border-b px-2 py-1 text-center">{fmtDateBR(ord.dataInicio)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <span className="text-slate-500">Sem ordens.</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ DASHBOARD VIEW ---------------------------- */
function DashboardView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/summary`);
      if (!res.ok) throw new Error("Erro ao carregar dashboard");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <Card
        title="Dashboard financeiro"
        subtitle="Por enquanto, este resumo reflete os valores previstos das Ordens. Entradas reais virão com Pagamentos."
        right={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={load} disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar"}
            </Button>
          </div>
        }
      >
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border bg-white p-4">
            <p className="text-xs text-slate-500">Clientes cadastrados</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {data?.totalClients ?? "—"}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <p className="text-xs text-slate-500">Ordens</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {data?.totalOrders ?? "—"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="green">Ativas: {data?.totalAtivas ?? "—"}</Badge>
              <Badge tone="slate">Concluídas: {data?.totalConcluidas ?? "—"}</Badge>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <p className="text-xs text-slate-500">Total previsto</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {data ? fmtBRL(data.totalValorPrevisto) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Somatório de valorTotalPrevisto</p>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <p className="text-xs text-slate-500">Ambiente</p>
            <p className="mt-2 text-sm font-medium text-slate-900">API Base</p>
            <p className="mt-1 text-xs font-mono break-all text-slate-600">
              {API_BASE}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function useClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pad = (n) => String(n).padStart(2, "0");

  return {
    date: `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
  };
}

/* ---------------------------------- App ---------------------------------- */
export default function App() {
  const backend = useBackendStatus();
  const [view, setView] = useState("create"); // create | list | dashboard

  const backendLabel = backend.loading ? "verificando..." : backend.ok ? "ok" : "erro";

  const navItem = (key, label) => (
    <button
      onClick={() => setView(key)}
      className={cx(
        "w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition",
        view === key
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-700 hover:bg-slate-100"
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Topbar */}
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Controles-AMR</h1>
            <p className="text-xs text-slate-500">
              Controle de recebimentos, repasses e obrigações internas – AMR Advogados
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone={backendLabel === "ok" ? "green" : backendLabel === "erro" ? "red" : "amber"}>
              Backend: {backendLabel}
            </Badge>
          </div>
        </div>
      </header>

      {/* Layout */}
      <div className="mx-auto max-w-7xl px-6 py-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="rounded-2xl border bg-white shadow-sm p-4 h-fit">
          <div className="mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Módulos
            </p>
          </div>

          <div className="space-y-2">
            {navItem("create", "Cadastro rápido (Cliente + Ordem)")}
            {navItem("list", "Listagem (Clientes & Ordens)")}
            {navItem("dashboard", "Dashboard financeiro")}
          </div>

          <div className="mt-4 rounded-2xl border bg-slate-50/60 p-3">
            <p className="text-xs text-slate-600">
              Dica: use a Listagem para validar rapidamente os cadastros feitos no Cadastro rápido.
            </p>
          </div>
        </aside>

        {/* Content */}
        <main className="space-y-6">
          {view === "create" && <ClientOrderForm />}
          {view === "list" && <ClientsOrdersList />}
          {view === "dashboard" && <DashboardView />}
        </main>
      </div>
    </div>
  );
}
