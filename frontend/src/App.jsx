import React, { useEffect, useMemo, useState } from "react";
import logoSrc from "./assets/logo.png";

/** Helpers */
function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function moneyBRL(value) {
  if (value == null) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
  };
}

/** Minimal icons (no deps) */
const Icon = {
  plus: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  list: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" {...props}>
      <path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M3.5 6h.5M3.5 12h.5M3.5 18h.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  chart: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" {...props}>
      <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 16v-6M12 16V8M16 16v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  lock: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" {...props}>
      <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 11h12v9H6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  settings: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" {...props}>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" />
      <path
        d="M19.4 15a7.97 7.97 0 0 0 .1-3l2-1.2-2-3.5-2.3.7a7.8 7.8 0 0 0-2.6-1.5L12 2 9.4 6.5A7.8 7.8 0 0 0 6.8 8l-2.3-.7-2 3.5 2 1.2a8 8 0 0 0 0 3l-2 1.2 2 3.5 2.3-.7c.8.7 1.7 1.2 2.6 1.5L12 22l2.6-4.5c.9-.3 1.8-.8 2.6-1.5l2.3.7 2-3.5-2-1.2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

function Badge({ tone = "slate", children }) {
  const map = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-800 border-blue-200",
    green: "bg-emerald-50 text-emerald-800 border-emerald-200",
    red: "bg-red-50 text-red-800 border-red-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
  };
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", map[tone])}>
      {children}
    </span>
  );
}

function Card({ title, subtitle, children, right }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      {(title || right) && (
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

function Input({ label, hint, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-slate-700">{label}</span>}
      <input
        {...props}
        className={cx(
          "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none",
          "focus:border-blue-300 focus:ring-2 focus:ring-blue-100",
          props.className
        )}
      />
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

function Select({ label, hint, children, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-slate-700">{label}</span>}
      <select
        {...props}
        className={cx(
          "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none",
          "focus:border-blue-300 focus:ring-2 focus:ring-blue-100",
          props.className
        )}
      >
        {children}
      </select>
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

function Button({ variant = "primary", children, ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition shadow-sm";
  const variants = {
    primary: "bg-blue-900 text-white hover:bg-blue-800 focus:ring-2 focus:ring-blue-200",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
  };
  return (
    <button
      {...props}
      className={cx(base, variants[variant], props.disabled && "opacity-60 cursor-not-allowed", props.className)}
    >
      {children}
    </button>
  );
}

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-white/80 backdrop-blur">
      <div className="rounded-2xl border bg-white px-6 py-5 shadow-sm text-center">
        <img src={logoSrc} alt="AMR Advogados" className="mx-auto h-10 w-auto max-w-[240px] object-contain" />
        <p className="mt-3 text-sm font-medium text-slate-900">Carregando…</p>
        <p className="mt-1 text-xs text-slate-500">Conectando ao backend</p>
      </div>
    </div>
  );
}

export default function App() {
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const clock = useClock();

  const [view, setView] = useState("create");

  const viewTitle = useMemo(
    () => ({
      create: "Cadastro rápido",
      list: "Clientes & Ordens",
      dashboard: "Dashboard financeiro",
    }),
    []
  );

  const [backend, setBackend] = useState({ loading: true, ok: false, label: "verificando" });

  useEffect(() => {
    let alive = true;
    async function ping() {
      setBackend({ loading: true, ok: false, label: "verificando" });
      try {
        const r = await fetch(`${API_BASE}/api/health`);
        if (!alive) return;
        if (r.ok) setBackend({ loading: false, ok: true, label: "ok" });
        else setBackend({ loading: false, ok: false, label: "erro" });
      } catch {
        if (!alive) return;
        setBackend({ loading: false, ok: false, label: "erro" });
      }
    }
    ping();
    return () => {
      alive = false;
    };
  }, [API_BASE]);

  // screens state
  const [form, setForm] = useState({
    cpfCnpj: "",
    nomeRazaoSocial: "",
    email: "",
    telefone: "",
    descricao: "",
    tipoContrato: "",
    valorTotalPrevisto: "",
    modeloPagamento: "AVISTA",
    dataInicio: "",
  });

  const [createStatus, setCreateStatus] = useState({ type: "idle", msg: "" });

  const [filters, setFilters] = useState({ q: "", status: "ALL" });
  const [listState, setListState] = useState({ loading: false, error: "", data: [] });

  const [dashState, setDashState] = useState({ loading: false, error: "", data: null });

  async function createClientAndOrder() {
    setCreateStatus({ type: "loading", msg: "" });

    try {
      const payload = {
        cpfCnpj: form.cpfCnpj?.trim(),
        nomeRazaoSocial: form.nomeRazaoSocial?.trim(),
        email: form.email?.trim() || null,
        telefone: form.telefone?.trim() || null,

        // ordem (não obrigatória no seu fluxo futuro; aqui mantemos como está no protótipo)
        ordem: {
          descricao: form.descricao?.trim() || null,
          tipoContrato: form.tipoContrato?.trim() || null,
          valorTotalPrevisto: form.valorTotalPrevisto ? String(form.valorTotalPrevisto).replace(",", ".") : null,
          modeloPagamento: form.modeloPagamento,
          dataInicio: form.dataInicio ? new Date(form.dataInicio).toISOString() : new Date().toISOString(),
        },
      };

      const r = await fetch(`${API_BASE}/api/clients-and-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok) throw new Error(j?.message || "Falha ao criar cliente + ordem");

      setCreateStatus({
        type: "success",
        msg: `Criado! Cliente #${j?.cliente?.id ?? "?"}, Ordem #${j?.ordem?.id ?? "?"} (seq. ${j?.ordem?.sequenciaCliente ?? "?"})`,
      });

      // limpa parcialmente
      setForm((p) => ({ ...p, descricao: "", tipoContrato: "", valorTotalPrevisto: "" }));
    } catch (e) {
      setCreateStatus({ type: "error", msg: e?.message || "Erro inesperado" });
    }
  }

  async function loadClientsWithOrders() {
    setListState((s) => ({ ...s, loading: true, error: "" }));

    const qs = new URLSearchParams();
    if (filters.q?.trim()) qs.set("q", filters.q.trim());
    if (filters.status && filters.status !== "ALL") qs.set("status", filters.status);

    try {
      const r = await fetch(`${API_BASE}/api/clients-with-orders?${qs.toString()}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || "Erro ao listar clientes + ordens");
      setListState({ loading: false, error: "", data: Array.isArray(j) ? j : [] });
    } catch (e) {
      setListState({ loading: false, error: e?.message || "Erro ao listar", data: [] });
    }
  }

  async function loadDashboard() {
    setDashState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const r = await fetch(`${API_BASE}/api/dashboard/summary`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || "Erro ao carregar dashboard");
      setDashState({ loading: false, error: "", data: j });
    } catch (e) {
      setDashState({ loading: false, error: e?.message || "Erro ao carregar dashboard", data: null });
    }
  }

  useEffect(() => {
    if (view === "list") loadClientsWithOrders();
    if (view === "dashboard") loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const navItem = (key, label, icon) => (
    <button
      onClick={() => setView(key)}
      className={cx(
        "w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition flex items-center gap-2",
        view === key ? "bg-blue-900 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"
      )}
    >
      <span className={cx("opacity-90", view === key ? "text-white" : "text-slate-500")}>{icon}</span>
      <span>{label}</span>
    </button>
  );

  // Loading overlay while pinging backend
  if (backend.loading) return <LoadingOverlay />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
        <div className="w-full px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logoSrc}
              alt="AMR Advogados"
              className="h-10 w-auto max-w-[240px] object-contain"
              title="AMR Advogados"
            />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold leading-tight truncate">AMR Advogados</h1>
              <p className="text-xs text-slate-500 truncate">
                Controle de recebimentos, repasses e obrigações internas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge tone="blue">{viewTitle[view] || "Módulo"}</Badge>
            <Badge tone={backend.label === "ok" ? "green" : backend.label === "erro" ? "red" : "amber"}>
              Backend: {backend.label}
            </Badge>
          </div>
        </div>
      </header>

      {/* Content grid */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 py-6">
        {/* Sidebar (left, close to margin) */}
        <aside className="pl-0 lg:pl-0">
          <div className="sticky top-[92px]">
            <div className="ml-4 lg:ml-4 rounded-2xl border bg-white shadow-sm p-4 flex flex-col h-[calc(100vh-140px)]">
              <div className="mb-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Operacional</p>
              </div>

              <div className="space-y-2 flex-1">
                {navItem("create", "Cadastro rápido", <Icon.plus />)}
                {navItem("list", "Clientes & Ordens", <Icon.list />)}
                {navItem("dashboard", "Dashboard financeiro", <Icon.chart />)}

                <div className="mt-5">
                  <p className="mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Administrativo
                  </p>

                  <div className="space-y-2">
                    <button
                      disabled
                      className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium flex items-center gap-2 border bg-slate-50 text-slate-400 cursor-not-allowed"
                      title="Disponível quando o login estiver ativo"
                    >
                      <Icon.lock />
                      Controle de acesso
                    </button>

                    <button
                      disabled
                      className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium flex items-center gap-2 border bg-slate-50 text-slate-400 cursor-not-allowed"
                      title="Em breve"
                    >
                      <Icon.settings />
                      Configurações
                    </button>
                  </div>
                </div>
              </div>

              {/* Sidebar footer */}
              <div className="mt-4 border-t pt-3 space-y-3 text-xs text-slate-600">
                <div className="flex items-center justify-between font-mono">
                  <span>{clock.date}</span>
                  <span>{clock.time}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Usuário</span>
                  <Badge tone="slate">Em desenvolvimento</Badge>
                </div>

                <button
                  disabled
                  className="w-full rounded-xl border px-3 py-2 text-center text-xs font-medium text-slate-400 cursor-not-allowed bg-slate-50"
                  title="Disponível quando o login estiver ativo"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="pr-6 pl-4 lg:pl-0">
          {view === "create" && (
            <div className="space-y-6">
              <Card
                title="Cadastro rápido: Cliente + Ordem"
                subtitle="Crie um Cliente e uma Ordem de Pagamento em uma única ação."
                right={<Badge tone="slate">API {API_BASE.replace(/^https?:\/\//, "")}</Badge>}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Dados do cliente</h4>
                      <p className="text-xs text-slate-500">CPF/CNPJ, nome e contato principal.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        label="CPF/CNPJ"
                        placeholder="Ex.: 111.222.333-44"
                        value={form.cpfCnpj}
                        onChange={(e) => setForm((p) => ({ ...p, cpfCnpj: e.target.value }))}
                      />
                      <Input
                        label="Nome / Razão Social"
                        placeholder="Ex.: Empresa X Ltda."
                        value={form.nomeRazaoSocial}
                        onChange={(e) => setForm((p) => ({ ...p, nomeRazaoSocial: e.target.value }))}
                      />
                      <Input
                        label="E-mail"
                        placeholder="financeiro@empresa.com"
                        value={form.email}
                        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      />
                      <Input
                        label="Telefone"
                        placeholder="(99) 9 9999-9999"
                        value={form.telefone}
                        onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Dados da ordem de pagamento</h4>
                      <p className="text-xs text-slate-500">Contrato/ocorrência vinculada ao cliente.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        label="Descrição / Objeto"
                        placeholder="Ex.: Contrato consultivo mensal"
                        value={form.descricao}
                        onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                      />
                      <Input
                        label="Tipo de contrato"
                        placeholder="Ex.: esporádico, recorrente..."
                        value={form.tipoContrato}
                        onChange={(e) => setForm((p) => ({ ...p, tipoContrato: e.target.value }))}
                      />
                      <Input
                        label="Valor total previsto"
                        placeholder="Ex.: 10000"
                        value={form.valorTotalPrevisto}
                        onChange={(e) => setForm((p) => ({ ...p, valorTotalPrevisto: e.target.value }))}
                      />
                      <Select
                        label="Modelo de pagamento"
                        value={form.modeloPagamento}
                        onChange={(e) => setForm((p) => ({ ...p, modeloPagamento: e.target.value }))}
                      >
                        <option value="AVISTA">À vista</option>
                        <option value="ENTRADA_E_PARCELAS">Entrada + parcelas</option>
                        <option value="APENAS_PARCELAS">Apenas parcelas</option>
                      </Select>

                      <Input
                        label="Data de início"
                        type="date"
                        value={form.dataInicio}
                        onChange={(e) => setForm((p) => ({ ...p, dataInicio: e.target.value }))}
                        className="md:col-span-2"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <Button onClick={createClientAndOrder} disabled={createStatus.type === "loading"}>
                        {createStatus.type === "loading" ? "Salvando..." : "Salvar cliente + ordem"}
                      </Button>

                      {createStatus.type === "success" && <Badge tone="green">{createStatus.msg}</Badge>}
                      {createStatus.type === "error" && <Badge tone="red">{createStatus.msg}</Badge>}
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Dica" subtitle="Use a Listagem para validar rapidamente os cadastros feitos no Cadastro rápido.">
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setView("list")}>
                    Ir para Listagem
                  </Button>
                  <Button variant="ghost" onClick={() => setView("dashboard")}>
                    Ver Dashboard
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {view === "list" && (
            <div className="space-y-6">
              <Card
                title="Listagem: Clientes & Ordens"
                subtitle="Filtros por nome/CPF/CNPJ e status da ordem."
                right={
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={loadClientsWithOrders}>
                      Atualizar
                    </Button>
                  </div>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <Input
                    label="Busca"
                    placeholder="Nome ou CPF/CNPJ..."
                    value={filters.q}
                    onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                  />
                  <Select
                    label="Status da ordem"
                    value={filters.status}
                    onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="ALL">Todas</option>
                    <option value="ATIVA">Ativas</option>
                    <option value="CONCLUIDA">Concluídas</option>
                    <option value="CANCELADA">Canceladas</option>
                  </Select>

                  <div className="flex items-end">
                    <Button onClick={loadClientsWithOrders} className="w-full">
                      Aplicar filtros
                    </Button>
                  </div>
                </div>

                {listState.loading && <p className="text-sm text-slate-500">Carregando...</p>}
                {listState.error && <p className="text-sm text-red-700">{listState.error}</p>}

                {!listState.loading && !listState.error && listState.data?.length === 0 && (
                  <p className="text-sm text-slate-500">Nenhum cliente encontrado.</p>
                )}

                {!listState.loading && !listState.error && listState.data?.length > 0 && (
                  <div className="overflow-auto rounded-xl border">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 border-b">
                        <tr className="text-left text-xs font-semibold text-slate-600">
                          <th className="px-4 py-3">Cliente</th>
                          <th className="px-4 py-3">CPF/CNPJ</th>
                          <th className="px-4 py-3">Contato</th>
                          <th className="px-4 py-3">Ordens</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listState.data.map((c, idx) => (
                          <tr key={c.id} className={cx("border-b", idx % 2 === 0 ? "bg-white" : "bg-slate-50/40")}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{c.nomeRazaoSocial}</div>
                              <div className="text-xs text-slate-500">ID #{c.id}</div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">{c.cpfCnpj}</td>
                            <td className="px-4 py-3">
                              <div className="text-xs text-slate-700">{c.email || "—"}</div>
                              <div className="text-xs text-slate-500">{c.telefone || "—"}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-2">
                                {(c.ordens || []).map((o) => (
                                  <div key={o.id} className="rounded-xl border bg-white px-3 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-sm font-semibold text-slate-900">
                                        {o.descricao || "Ordem sem descrição"}{" "}
                                        <span className="text-xs font-normal text-slate-500">
                                          (seq. {o.sequenciaCliente})
                                        </span>
                                      </div>
                                      <Badge tone={o.status === "ATIVA" ? "green" : o.status === "CONCLUIDA" ? "slate" : "amber"}>
                                        {o.status}
                                      </Badge>
                                    </div>
                                    <div className="mt-1 text-xs text-slate-600">
                                      {o.tipoContrato ? `${o.tipoContrato} • ` : ""}
                                      {o.valorTotalPrevisto ? `Previsto: ${moneyBRL(o.valorTotalPrevisto)}` : "Sem valor previsto"}
                                    </div>
                                  </div>
                                ))}
                                {(c.ordens || []).length === 0 && <span className="text-xs text-slate-500">Sem ordens</span>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {view === "dashboard" && (
            <div className="space-y-6">
              <Card
                title="Dashboard financeiro"
                subtitle="Resumo dos cadastros e ordens."
                right={
                  <Button variant="secondary" onClick={loadDashboard}>
                    Atualizar
                  </Button>
                }
              >
                {dashState.loading && <p className="text-sm text-slate-500">Carregando...</p>}
                {dashState.error && <p className="text-sm text-red-700">{dashState.error}</p>}

                {!dashState.loading && !dashState.error && dashState.data && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="rounded-2xl border bg-white p-4">
                      <p className="text-xs text-slate-500">Clientes</p>
                      <p className="mt-1 text-2xl font-semibold">{dashState.data.totalClients ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border bg-white p-4">
                      <p className="text-xs text-slate-500">Ordens</p>
                      <p className="mt-1 text-2xl font-semibold">{dashState.data.totalOrders ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border bg-white p-4">
                      <p className="text-xs text-slate-500">Ativas</p>
                      <p className="mt-1 text-2xl font-semibold">{dashState.data.totalAtivas ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border bg-white p-4">
                      <p className="text-xs text-slate-500">Concluídas</p>
                      <p className="mt-1 text-2xl font-semibold">{dashState.data.totalConcluidas ?? 0}</p>
                    </div>

                    <div className="md:col-span-4 rounded-2xl border bg-white p-4">
                      <p className="text-xs text-slate-500">Valor total previsto</p>
                      <p className="mt-1 text-2xl font-semibold">
                        {moneyBRL(dashState.data.totalValorPrevisto)}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        API base utilizada: <span className="font-mono">{API_BASE}</span>
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
