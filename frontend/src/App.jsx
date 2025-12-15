import React, { useEffect, useMemo, useState } from "react";
import RestTimer from "./components/RestTimer";
import { useLocation, useNavigate } from "react-router-dom";
import logoSrc from "./assets/logo.png";

import { apiFetch, setAuth, clearAuth } from "./lib/api";

/** =========================
 *  HELPERS — DIRETRIZES
 *  ========================= */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

// CPF/CNPJ: máscara + validação simples (crítica)
function onlyDigits(v) {
  return (v || "").replace(/\D+/g, "");
}

function isValidCPF(raw) {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === Number(cpf[10]);
}

function isValidCNPJ(raw) {
  const cnpj = onlyDigits(raw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (base) => {
    let pos = base.length - 7;
    let sum = 0;
    for (let i = base.length; i >= 1; i--) {
      sum += Number(base[base.length - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const base12 = cnpj.slice(0, 12);
  const d1 = calc(base12);
  const d2 = calc(base12 + String(d1));
  return cnpj.endsWith(`${d1}${d2}`);
}

function maskCpfCnpj(value) {
  const v = onlyDigits(value);
  if (v.length <= 11) {
    // CPF
    return v
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})$/, "$1.$2.$3-$4");
  }
  // CNPJ
  return v
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d{1,2})$/, "$1.$2.$3/$4-$5");
}

function isValidCpfCnpj(value) {
  const v = onlyDigits(value);
  if (v.length === 11) return isValidCPF(v);
  if (v.length === 14) return isValidCNPJ(v);
  return false;
}

// Telefone: (99) 9 9999-9999 + validação básica
function maskPhone(value) {
  const v = onlyDigits(value).slice(0, 11); // 11 dígitos
  if (!v) return "";
  if (v.length <= 2) return `(${v}`;
  if (v.length <= 3) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  if (v.length <= 7) return `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3)}`;
  return `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3, 7)}-${v.slice(7)}`;
}

function isValidPhone(value) {
  return onlyDigits(value).length === 11;
}

// Datas DD/MM/AAAA
function maskDate(value) {
  const v = onlyDigits(value).slice(0, 8);
  if (!v) return "";
  if (v.length <= 2) return v;
  if (v.length <= 4) return `${v.slice(0, 2)}/${v.slice(2)}`;
  return `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
}

function parseDateDDMMYYYY(value) {
  const m = (value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (d.getUTCFullYear() !== yyyy || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return null;
  return d;
}

function formatDateDDMMYYYY(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatTimeHHMMSS(date) {
  const d = new Date(date);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

// Valores R$ (digitando 1 => 0,01 etc.)
function centsFromInputDigits(value) {
  const v = onlyDigits(value);
  const n = Number(v || "0");
  return n; // em centavos
}

function formatBRLFromCents(cents) {
  const n = Number(cents || 0) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatBRLFromNumber(number) {
  const n = Number(number || 0);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** =========================
 *  ICONS (minimalistas)
 *  ========================= */
const Icon = {
  user: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2.25c-4.2 0-7.5 2.1-7.5 4.5v.75h15v-.75c0-2.4-3.3-4.5-7.5-4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  ),
  plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  list: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  chart: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 16v-6M12 16V8M16 16v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  shield: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3 20 7v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  ),
  lock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 11h12v10H6V11Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
};

/** =========================
 *  UI COMPONENTS
 *  ========================= */
function Badge({ children, tone = "slate" }) {
  const toneMap = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return (
    <span className={cx("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border", toneMap[tone])}>
      {children}
    </span>
  );
}

function Card({ title, subtitle, children, right }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="px-5 py-4 border-b flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text", error, help, inputMode, maxLength }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-slate-700">{label}</div>
      <input
        className={cx(
          "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
          error ? "border-rose-300 focus:ring-2 focus:ring-rose-100" : "border-slate-200 focus:ring-2 focus:ring-slate-100"
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
      />
      {help ? <div className="mt-1 text-xs text-slate-500">{help}</div> : null}
      {error ? <div className="mt-1 text-xs text-rose-600">{error}</div> : null}
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="text-xs font-semibold text-slate-700">{label}</div>
      <select
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** =========================
 *  APP
 *  ========================= */

const VIEWS = {
  LOGIN: "login",
  DASH: "dashboard",
  LIST: "clients-orders",
  CREATE: "create-client-order",
  REPORTS: "reports",
  ADMIN_USERS: "admin-users",
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Auth state (localStorage via api.js)
  const [auth, setAuthState] = useState(() => {
    try {
      const raw = localStorage.getItem("amr_auth");
      return raw ? JSON.parse(raw) : { token: null, user: null };
    } catch {
      return { token: null, user: null };
    }
  });

  // View selection (simple; sem router de rotas ainda)
  const [view, setView] = useState(() => {
    const p = new URLSearchParams(location.search);
    return p.get("view") || (auth?.token ? VIEWS.DASH : VIEWS.LOGIN);
  });

  // Clock (diretriz: DD/MM/AAAA e HH:MM:SS)
  const [clockNow, setClockNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const clock = useMemo(() => {
    return {
      date: formatDateDDMMYYYY(clockNow),
      time: formatTimeHHMMSS(clockNow),
    };
  }, [clockNow]);

  const isAuthed = Boolean(auth?.token);
  const isAdmin = auth?.user?.role === "ADMIN";

  // backend health / module label
  const [backendOk, setBackendOk] = useState("verificando...");
  const moduleName = useMemo(() => {
    const map = {
      [VIEWS.LOGIN]: "Login",
      [VIEWS.DASH]: "Dashboard",
      [VIEWS.LIST]: "Clientes & Ordens",
      [VIEWS.CREATE]: "Cadastro rápido",
      [VIEWS.REPORTS]: "Relatórios",
      [VIEWS.ADMIN_USERS]: "Usuários",
    };
    return map[view] || "Módulo";
  }, [view]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await apiFetch("/api/health", { method: "GET" });
        if (alive) setBackendOk("ok");
      } catch {
        if (alive) setBackendOk("erro");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // persist auth (api.js também mantém helpers)
  useEffect(() => {
    try {
      localStorage.setItem("amr_auth", JSON.stringify(auth));
    } catch {}
  }, [auth]);

  // sync view in querystring (pra facilitar dev)
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if ((p.get("view") || "") !== view) {
      p.set("view", view);
      navigate({ search: p.toString() }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function go(nextView) {
    setView(nextView);
  }

  function logout() {
    clearAuth();
    setAuthState({ token: null, user: null });
    setAuth(null);
    setView(VIEWS.LOGIN);
  }

  // nav item renderer
  function navItem(key, label, icon, opts = {}) {
    const active = view === key;
    const disabled = Boolean(opts.disabled);
    return (
      <button
        type="button"
        onClick={() => !disabled && go(key)}
        disabled={disabled}
        title={opts.title || ""}
        className={cx(
          "w-full rounded-xl px-3 py-2 text-sm font-semibold flex items-center gap-2 border",
          disabled
            ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
            : active
            ? "bg-amr-navy text-white border-amr-navy"
            : "bg-white text-slate-700 hover:bg-slate-50"
        )}
      >
        <span className={cx("inline-flex", active ? "text-white" : disabled ? "text-slate-300" : "text-slate-500")}>
          {icon}
        </span>
        {label}
      </button>
    );
  }

  /** =========================
   *  LOGIN
   *  ========================= */
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  async function doLogin() {
    setLoginError("");
    setLoginLoading(true);
    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: { email: loginEmail, senha: loginSenha },
      });

      // esperado: { token, user: { id, nome, email, role } }
      const nextAuth = { token: data.token, user: data.user };
      setAuthState(nextAuth);
      setAuth(nextAuth);

      setView(VIEWS.DASH);
    } catch (e) {
      setLoginError(e?.message || "Erro no login");
    } finally {
      setLoginLoading(false);
    }
  }

  /** =========================
   *  CADASTRO RÁPIDO (Cliente + Ordem)
   *  ========================= */
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [nomeRazaoSocial, setNomeRazaoSocial] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [ordemDescricao, setOrdemDescricao] = useState("");
  const [ordemTipoContrato, setOrdemTipoContrato] = useState("");
  const [ordemValor, setOrdemValor] = useState(""); // digitado
  const [ordemModelo, setOrdemModelo] = useState("AVISTA");
  const [ordemDataInicio, setOrdemDataInicio] = useState("");

  const [createOk, setCreateOk] = useState("");
  const [createErr, setCreateErr] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  async function createClientAndOrder() {
    setCreateOk("");
    setCreateErr("");

    const cpfCnpjMasked = maskCpfCnpj(cpfCnpj);
    const isCpfCnpjOk = isValidCpfCnpj(cpfCnpjMasked);

    if (!isCpfCnpjOk) {
      setCreateErr("CPF/CNPJ inválido.");
      return;
    }
    if (!nomeRazaoSocial.trim()) {
      setCreateErr("Nome/Razão Social é obrigatório.");
      return;
    }
    if (telefone && !isValidPhone(telefone)) {
      setCreateErr("Telefone inválido.");
      return;
    }
    const d = parseDateDDMMYYYY(ordemDataInicio);
    if (!d) {
      setCreateErr("Data de início inválida (DD/MM/AAAA).");
      return;
    }

    const cents = centsFromInputDigits(ordemValor);

    setCreateLoading(true);
    try {
      const payload = {
        cliente: {
          cpfCnpj: onlyDigits(cpfCnpjMasked),
          nomeRazaoSocial: nomeRazaoSocial.trim(),
          email: email.trim() || null,
          telefone: onlyDigits(telefone) || null,
        },
        ordem: {
          descricao: ordemDescricao.trim() || null,
          tipoContrato: ordemTipoContrato.trim() || null,
          valorTotalPrevisto: cents ? String(Number(cents) / 100) : null, // backend guarda Decimal
          modeloPagamento: ordemModelo,
          dataInicio: d.toISOString(),
        },
      };

      await apiFetch("/api/clients-and-orders", { method: "POST", body: payload });

      setCreateOk("Cliente + Ordem salvos com sucesso.");
      // limpeza mínima
      setCpfCnpj("");
      setNomeRazaoSocial("");
      setEmail("");
      setTelefone("");
      setOrdemDescricao("");
      setOrdemTipoContrato("");
      setOrdemValor("");
      setOrdemModelo("AVISTA");
      setOrdemDataInicio("");
    } catch (e) {
      setCreateErr(e?.message || "Erro ao salvar");
    } finally {
      setCreateLoading(false);
    }
  }

  /** =========================
   *  LISTAGEM (Clientes + Ordens)
   *  ========================= */
  const [listLoading, setListLoading] = useState(false);
  const [listErr, setListErr] = useState("");
  const [clientsWithOrders, setClientsWithOrders] = useState([]);

  async function loadClientsWithOrders() {
    setListErr("");
    setListLoading(true);
    try {
      const data = await apiFetch("/api/clients-with-orders", { method: "GET" });
      setClientsWithOrders(data || []);
    } catch (e) {
      setListErr(e?.message || "Erro ao listar clientes + ordens");
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthed && view === VIEWS.LIST) loadClientsWithOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, view]);

  /** =========================
   *  DASHBOARD
   *  ========================= */
  const [dashLoading, setDashLoading] = useState(false);
  const [dashErr, setDashErr] = useState("");
  const [dash, setDash] = useState(null);

  async function loadDash() {
    setDashErr("");
    setDashLoading(true);
    try {
      const data = await apiFetch("/api/dashboard/summary", { method: "GET" });
      setDash(data);
    } catch (e) {
      setDashErr(e?.message || "Erro ao carregar dashboard");
    } finally {
      setDashLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthed && view === VIEWS.DASH) loadDash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, view]);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar fixa (layout Sidebar 2) */}
      <aside className="fixed inset-y-0 left-0 w-[280px] bg-[#081A33] text-white flex flex-col">
        {/* Marca */}
        <div className="px-6 pt-6 pb-4 flex flex-col items-center">
          <div className="rounded-2xl bg-white/95 p-3 shadow-sm">
            <img src={logoSrc} alt="AMR" className="h-12 w-auto" />
          </div>
          <p className="mt-3 text-sm font-semibold tracking-wide text-white">AMR Advogados</p>
        </div>

        {/* Navegação */}
        <div className="px-4 flex-1 overflow-hidden flex flex-col">
          <div className="mb-3">
            <p className="text-[11px] font-semibold text-white/70 uppercase tracking-wide">Operacional</p>
          </div>

          <div className="space-y-2 flex-1 overflow-hidden">
            {!isAuthed ? (
              navItem(VIEWS.LOGIN, "Login", <Icon.user />)
            ) : (
              <>
                {/* ✅ PERMISSÃO: Cadastro rápido só para ADMIN */}
                {isAdmin ? navItem(VIEWS.CREATE, "Cadastro rápido", <Icon.plus />) : null}

                {navItem(VIEWS.LIST, "Listagem (Clientes & Ordens)", <Icon.list />)}
                {navItem(VIEWS.DASH, "Dashboard financeiro", <Icon.chart />)}
                {navItem(VIEWS.REPORTS, "Relatórios", <Icon.shield />, {
                  disabled: true,
                  title: "Em breve",
                })}

                {/* ✅ Admin section só para ADMIN */}
                {isAdmin ? (
                  <>
                    <div className="pt-4">
                      <p className="text-[11px] font-semibold text-white/70 uppercase tracking-wide">Administrativo</p>
                    </div>

                    {navItem(VIEWS.ADMIN_USERS, "Usuários", <Icon.user />, {
                      disabled: true,
                      title: "Em breve",
                    })}

                    {navItem("access-control", "Controle de acesso", <Icon.lock />, {
                      disabled: true,
                      title: "Em breve",
                    })}
                  </>
                ) : null}
              </>
            )}
          </div>

          {/* Espaçador para manter o rodapé sempre visível */}
          <div className="flex-1" />
        </div>

        {/* Rodapé da sidebar: Descanso + usuário + data/hora + sair */}
        <div className="px-4 pb-4 space-y-3">
          {/* TEMP: Descanso / Repouso (mantém!) */}
          <RestTimer />

          {/* Nome + role */}
          <div className="text-xs text-white/80 flex items-center justify-between">
            <span className="truncate max-w-[170px]">
              {auth.user?.nome || (isAuthed ? "—" : "Em desenvolvimento")}
            </span>
            <span className="font-semibold">{auth.user?.role || (isAuthed ? "—" : "—")}</span>
          </div>

          {/* Data + hora */}
          <div className="text-xs text-white/70 flex items-center justify-between font-mono">
            <span>{clock.date}</span>
            <span>{clock.time}</span>
          </div>

          {/* Sair */}
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="ml-[280px] flex-1 min-h-screen overflow-y-auto">
        <div className="px-6 lg:px-8 py-6 space-y-6">
          {/* Cabeçalho interno (sem topo fixo) */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">{moduleName}</p>
              <p className="text-xs text-slate-500">Controle de recebimentos, repasses e obrigações internas</p>
            </div>
            <Badge tone={backendOk === "ok" ? "green" : backendOk === "erro" ? "red" : "slate"}>
              {backendOk === "ok"
                ? "Backend: ok"
                : backendOk === "erro"
                ? "Backend: erro"
                : "Backend: verificando..."}
            </Badge>
          </div>

          {!isAuthed && view === VIEWS.LOGIN && (
            <Card title="Login" subtitle="Entre com seu usuário e senha para acessar o sistema.">
              <div className="grid grid-cols-1 gap-4">
                <Input label="E-mail" value={loginEmail} onChange={setLoginEmail} placeholder="seu@email.com" />
                <Input
                  label="Senha"
                  value={loginSenha}
                  onChange={setLoginSenha}
                  placeholder="••••••••"
                  type="password"
                />

                {loginError ? <div className="text-sm text-rose-600">{loginError}</div> : null}

                <button
                  type="button"
                  onClick={doLogin}
                  disabled={loginLoading}
                  className={cx(
                    "rounded-xl bg-amr-navy text-white px-4 py-2 text-sm font-semibold",
                    loginLoading ? "opacity-70 cursor-not-allowed" : "hover:opacity-95"
                  )}
                >
                  {loginLoading ? "Entrando..." : "Entrar"}
                </button>
              </div>
            </Card>
          )}

          {isAuthed && view === VIEWS.CREATE && (
            <Card
              title="Cadastro rápido: Cliente + Ordem"
              subtitle="Crie um Cliente e uma Ordem de Pagamento em uma única ação."
              right={<Badge tone="blue">{import.meta.env.VITE_API_URL ? "API externa" : "API /api"}</Badge>}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Cliente</p>
                  <p className="text-xs text-slate-500">Dados principais para identificação e contato.</p>

                  <div className="mt-4 space-y-3">
                    <Input
                      label="CPF/CNPJ"
                      value={maskCpfCnpj(cpfCnpj)}
                      onChange={setCpfCnpj}
                      placeholder="Ex.: 111.222.333-44"
                      error={cpfCnpj && !isValidCpfCnpj(cpfCnpj) ? "CPF/CNPJ inválido" : ""}
                    />
                    <Input
                      label="Nome / Razão Social"
                      value={nomeRazaoSocial}
                      onChange={setNomeRazaoSocial}
                      placeholder="Ex.: Empresa X Ltda."
                    />
                    <Input
                      label="E-mail"
                      value={email}
                      onChange={setEmail}
                      placeholder="financeiro@empresa.com"
                      type="email"
                    />
                    <Input
                      label="Telefone"
                      value={maskPhone(telefone)}
                      onChange={setTelefone}
                      placeholder="(99) 9 9999-9999"
                      error={telefone && !isValidPhone(telefone) ? "Telefone inválido" : ""}
                      inputMode="tel"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Ordem de Pagamento</p>
                  <p className="text-xs text-slate-500">Detalhes do contrato/ocorrência vinculada ao cliente.</p>

                  <div className="mt-4 space-y-3">
                    <Input
                      label="Descrição / Objeto"
                      value={ordemDescricao}
                      onChange={setOrdemDescricao}
                      placeholder="Ex.: Contrato consultivo mensal"
                    />
                    <Input
                      label="Tipo de contrato"
                      value={ordemTipoContrato}
                      onChange={setOrdemTipoContrato}
                      placeholder="Ex.: esporádico, recorrente..."
                    />

                    <Input
                      label="Valor total previsto"
                      value={formatBRLFromCents(centsFromInputDigits(ordemValor))}
                      onChange={setOrdemValor}
                      placeholder="Ex.: 10000"
                      help="(R$) Digitando 1 = 0,01; 12 = 0,12; 123 = 1,23; 123456 = 1.234,56"
                      inputMode="numeric"
                    />

                    <Select
                      label="Modelo de pagamento"
                      value={ordemModelo}
                      onChange={setOrdemModelo}
                      options={[
                        { value: "AVISTA", label: "À vista" },
                        { value: "ENTRADA_E_PARCELAS", label: "Entrada + parcelas" },
                        { value: "PARCELADO", label: "Parcelado" },
                      ]}
                    />

                    <Input
                      label="Data de início"
                      value={maskDate(ordemDataInicio)}
                      onChange={setOrdemDataInicio}
                      placeholder="dd/mm/aaaa"
                      error={ordemDataInicio && !parseDateDDMMYYYY(maskDate(ordemDataInicio)) ? "Data inválida" : ""}
                      inputMode="numeric"
                      maxLength={10}
                    />
                  </div>

                  {createErr ? <div className="mt-3 text-sm text-rose-600">{createErr}</div> : null}
                  {createOk ? <div className="mt-3 text-sm text-emerald-700">{createOk}</div> : null}

                  <button
                    type="button"
                    onClick={createClientAndOrder}
                    disabled={createLoading}
                    className={cx(
                      "mt-4 w-full rounded-xl bg-amr-navy text-white px-4 py-2 text-sm font-semibold",
                      createLoading ? "opacity-70 cursor-not-allowed" : "hover:opacity-95"
                    )}
                  >
                    {createLoading ? "Salvando..." : "Salvar cliente + ordem"}
                  </button>
                </div>
              </div>
            </Card>
          )}

          {isAuthed && view === VIEWS.LIST && (
            <Card
              title="Listagem (Clientes & Ordens)"
              subtitle="Use a Listagem para validar rapidamente os cadastros feitos no Cadastro rápido."
              right={
                <button
                  type="button"
                  onClick={loadClientsWithOrders}
                  className="rounded-xl border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Atualizar
                </button>
              }
            >
              {listLoading ? <p className="text-sm text-slate-500">Carregando...</p> : null}
              {listErr ? <p className="text-sm text-rose-600">{listErr}</p> : null}

              {!listLoading && !listErr && (
                <div className="space-y-4">
                  {clientsWithOrders.length === 0 ? (
                    <p className="text-sm text-slate-500">Sem dados ainda.</p>
                  ) : (
                    clientsWithOrders.map((c) => (
                      <div key={c.id} className="rounded-2xl border bg-white p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{c.nomeRazaoSocial}</p>
                            <p className="text-xs text-slate-500">{maskCpfCnpj(c.cpfCnpj)}</p>
                          </div>
                          <Badge tone={c.ativo ? "green" : "red"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {(c.ordens || []).map((o) => (
                            <div key={o.id} className="rounded-2xl border bg-slate-50 p-3">
                              <p className="text-sm font-semibold text-slate-900">
                                {o.descricao || "Ordem sem descrição"}
                              </p>
                              <p className="text-xs text-slate-500">
                                Seq.: {o.sequenciaCliente} • Status: {o.status}
                              </p>
                              <p className="mt-2 text-sm text-slate-700">
                                Valor previsto: R$ {formatBRLFromNumber(o.valorTotalPrevisto)}
                              </p>
                              <p className="text-xs text-slate-500">Início: {formatDateDDMMYYYY(o.dataInicio)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          )}

          {isAuthed && view === VIEWS.DASH && (
            <Card title="Dashboard financeiro" subtitle="Resumo geral (provisório).">
              {dashLoading ? <p className="text-sm text-slate-500">Carregando...</p> : null}
              {dashErr ? <p className="text-sm text-rose-600">{dashErr}</p> : null}

              {!dashLoading && !dashErr && dash && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-2xl border bg-white p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Clientes</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{dash.totalClients}</p>
                  </div>
                  <div className="rounded-2xl border bg-white p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ordens</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{dash.totalOrders}</p>
                  </div>
                  <div className="rounded-2xl border bg-white p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ativas</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{dash.totalAtivas}</p>
                  </div>
                  <div className="rounded-2xl border bg-white p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor previsto</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      R$ {Number(dash.totalValorPrevisto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
