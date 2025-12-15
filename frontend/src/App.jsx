import React, { useEffect, useMemo, useState } from "react";
import RestTimer from "./components/RestTimer";
import { useLocation, useNavigate } from "react-router-dom";
import logoSrc from "./assets/logo.png";

/** =========================
 *  HELPERS — DIRETRIZES
 *  ========================= */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function onlyDigits(v = "") {
  return String(v).replace(/\D/g, "");
}

// CPF/CNPJ — máscara + validação
function maskCpfCnpj(value = "") {
  const d = onlyDigits(value);
  if (d.length <= 11) {
    // CPF: 000.000.000-00
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4")
      .slice(0, 14);
  }
  // CNPJ: 00.000.000/0000-00
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5")
    .slice(0, 18);
}

function isValidCpf(cpfDigits) {
  const cpf = onlyDigits(cpfDigits);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calc = (base, factor) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const d1 = calc(cpf.slice(0, 9), 10);
  const d2 = calc(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

function isValidCnpj(cnpjDigits) {
  const cnpj = onlyDigits(cnpjDigits);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const calc = (base, weights) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += Number(base[i]) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calc(cnpj.slice(0, 12), weights1);
  const d2 = calc(cnpj.slice(0, 13), weights2);
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

function isValidCpfCnpj(value = "") {
  const d = onlyDigits(value);
  if (d.length === 11) return isValidCpf(d);
  if (d.length === 14) return isValidCnpj(d);
  return false;
}

// TELEFONE — máscara (99) 9 9999-9999
function maskPhone(value = "") {
  const d = onlyDigits(value).slice(0, 11);
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 3);
  const p3 = d.slice(3, 7);
  const p4 = d.slice(7, 11);

  if (d.length <= 2) return p1 ? `(${p1}` : "";
  if (d.length <= 3) return `(${p1}) ${p2}`;
  if (d.length <= 7) return `(${p1}) ${p2} ${p3}`;
  return `(${p1}) ${p2} ${p3}-${p4}`;
}

function isValidPhone(value = "") {
  return onlyDigits(value).length === 11; // (DD) 9 XXXX-XXXX
}

// DATAS — DD/MM/AAAA
function formatDateBR(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// HORAS — HH:MM:SS
function formatTimeBR(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseDateBR(ddmmyyyy) {
  const m = String(ddmmyyyy || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const dt = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
  return dt;
}

// VALORES — máscara moeda digitando 1 => 0,01 (centavos)
function onlyDigitsToCents(value = "") {
  const d = onlyDigits(value);
  return d ? Number(d) : 0;
}
function formatBRLFromCents(cents = 0) {
  const v = (Number(cents) || 0) / 100;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatBRLWithSymbolFromCents(cents = 0) {
  return `R$ ${formatBRLFromCents(cents)}`;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return {
    now,
    date: formatDateBR(now),
    time: formatTimeBR(now),
  };
}

/** =========================
 *  API helper (simples)
 *  ========================= */

const API_BASE =
  import.meta.env.VITE_API_URL?.trim() || "/api"; // em dev, pode cair no proxy do Vite

async function apiFetch(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || "Erro na requisição");
  return data;
}

/** =========================
 *  UI componentes base
 *  ========================= */

function Card({ title, subtitle, right, children }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Badge({ tone = "slate", children }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    navy: "bg-amr-navy/10 text-amr-navy border-amr-navy/20",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span className={cx("inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

function Input({ label, value, onChange, placeholder, error, helper, inputMode, maxLength }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <input
        className={cx(
          "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2",
          error ? "border-rose-300 focus:ring-rose-200" : "border-slate-200 focus:ring-slate-200"
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
      />
      {helper ? <p className="mt-1 text-[11px] text-slate-500">{helper}</p> : null}
      {error ? <p className="mt-1 text-[11px] text-rose-600 font-semibold">{error}</p> : null}
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <select
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
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

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white",
        disabled ? "bg-slate-300 cursor-not-allowed" : "bg-amr-navy hover:bg-amr-navy/90"
      )}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

/** =========================
 *  Ícones minimalistas
 *  ========================= */

const Icon = {
  plus: () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  list: () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  chart: () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 15V9M12 19V7M16 13V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  user: () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M20 21a8 8 0 1 0-16 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  ),
  lock: () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6 11h12v10H6V11Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  logout: () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M15 12H3m0 0 3-3M3 12l3 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
};

/** =========================
 *  APP
 *  ========================= */

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const clock = useClock();

  // views internas
  const [view, setView] = useState("login"); // login | create | list | dashboard

  // auth
  const [auth, setAuth] = useState(() => {
    try {
      const raw = localStorage.getItem("amr_auth");
      return raw ? JSON.parse(raw) : { token: null, user: null };
    } catch {
      return { token: null, user: null };
    }
  });

  const isAuthed = Boolean(auth?.token);

  // header: módulo no lugar do “Backend: ok”
  const moduleName = useMemo(() => {
    if (!isAuthed) return "Login";
    if (view === "create") return "Cadastro rápido";
    if (view === "list") return "Listagem";
    if (view === "dashboard") return "Dashboard";
    return "—";
  }, [isAuthed, view]);

  const [backendOk, setBackendOk] = useState("verificando...");

  useEffect(() => {
    let alive = true;
    apiFetch("/health")
      .then(() => alive && setBackendOk("ok"))
      .catch(() => alive && setBackendOk("erro"));
    return () => {
      alive = false;
    };
  }, []);

  // persist auth
  useEffect(() => {
    try {
      localStorage.setItem("amr_auth", JSON.stringify(auth));
    } catch {
      // ignore
    }
  }, [auth]);

  // sync route-ish (mantido simples)
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const v = q.get("view");
    if (v) setView(v);
  }, [location.search]);

  function go(v) {
    setView(v);
    const q = new URLSearchParams(location.search);
    q.set("view", v);
    navigate({ search: q.toString() }, { replace: true });
  }

  function logout() {
    setAuth({ token: null, user: null });
    go("login");
  }

  function navItem(key, label, icon) {
    const active = view === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => go(key)}
        className={cx(
          "w-full rounded-xl px-3 py-2 text-sm font-semibold flex items-center gap-2 border",
          active ? "bg-amr-navy text-white border-amr-navy" : "bg-white text-slate-700 hover:bg-slate-50"
        )}
      >
        <span className={cx("inline-flex", active ? "text-white" : "text-slate-500")}>{icon}</span>
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

  async function doLogin() {
    setLoginError("");
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: { email: loginEmail, senha: loginSenha },
      });
      setAuth({ token: data.token, user: data.user });
      go("dashboard");
    } catch (e) {
      setLoginError(e.message || "Erro no login");
    }
  }

  /** =========================
   *  CADASTRO RÁPIDO (Cliente + Ordem)
   *  ========================= */
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [nomeRazaoSocial, setNomeRazaoSocial] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");

  const [descricao, setDescricao] = useState("");
  const [tipoContrato, setTipoContrato] = useState("");
  const [valorPrevistoRaw, setValorPrevistoRaw] = useState("");
  const [modeloPagamento, setModeloPagamento] = useState("AVISTA");
  const [dataInicio, setDataInicio] = useState("");

  const cpfCnpjMasked = useMemo(() => maskCpfCnpj(cpfCnpj), [cpfCnpj]);
  const cpfCnpjValid = useMemo(() => (cpfCnpjMasked ? isValidCpfCnpj(cpfCnpjMasked) : false), [cpfCnpjMasked]);

  const telefoneMasked = useMemo(() => maskPhone(telefone), [telefone]);
  const telefoneValid = useMemo(() => (!telefoneMasked ? true : isValidPhone(telefoneMasked)), [telefoneMasked]);

  const valorCents = useMemo(() => onlyDigitsToCents(valorPrevistoRaw), [valorPrevistoRaw]);
  const valorDisplay = useMemo(() => formatBRLFromCents(valorCents), [valorCents]);

  const dataInicioOk = useMemo(() => (dataInicio ? Boolean(parseDateBR(dataInicio)) : false), [dataInicio]);

  const [saveMsg, setSaveMsg] = useState("");

  async function saveClientAndOrder() {
    setSaveMsg("");
    try {
      const body = {
        cliente: {
          cpfCnpj: onlyDigits(cpfCnpj),
          nomeRazaoSocial,
          email: email || null,
          telefone: onlyDigits(telefone),
        },
        ordem: {
          descricao,
          tipoContrato: tipoContrato || null,
          valorTotalPrevisto: valorCents ? String(valorCents / 100) : null, // backend grava Decimal
          modeloPagamento,
          dataInicio, // DD/MM/AAAA -> backend converte
        },
      };
      await apiFetch("/clients-and-orders", { method: "POST", body, token: auth.token });
      setSaveMsg("Salvo com sucesso ✅");
      // reset parcial (mantém cliente pra agilizar)
      setDescricao("");
      setTipoContrato("");
      setValorPrevistoRaw("");
      setModeloPagamento("AVISTA");
      setDataInicio("");
    } catch (e) {
      setSaveMsg(e.message || "Erro ao salvar");
    }
  }

  /** =========================
   *  LISTAGEM / DASH (mantidos)
   *  ========================= */
  const [listData, setListData] = useState([]);
  const [listErr, setListErr] = useState("");

  async function loadList() {
    setListErr("");
    try {
      const data = await apiFetch("/clients-with-orders", { token: auth.token });
      setListData(Array.isArray(data) ? data : []);
    } catch (e) {
      setListErr(e.message || "Erro ao carregar listagem");
    }
  }

  const [dash, setDash] = useState(null);
  const [dashErr, setDashErr] = useState("");

  async function loadDash() {
    setDashErr("");
    try {
      const data = await apiFetch("/dashboard/summary", { token: auth.token });
      setDash(data);
    } catch (e) {
      setDashErr(e.message || "Erro ao carregar dashboard");
    }
  }

  useEffect(() => {
    if (!isAuthed) return;
    if (view === "list") loadList();
    if (view === "dashboard") loadDash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, isAuthed]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 lg:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoSrc} alt="AMR" className="h-10 w-auto" />
            <div>
              <p className="text-sm font-semibold text-slate-900">AMR Advogados</p>
              <p className="text-xs text-slate-500">Controle de recebimentos, repasses e obrigações internas</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge tone={backendOk === "ok" ? "green" : backendOk === "erro" ? "red" : "slate"}>
              {moduleName}
            </Badge>

            {isAuthed ? (
              <button
                type="button"
                onClick={logout}
                className="ml-2 inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                title="Sair"
              >
                <Icon.logout />
                Sair
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto max-w-7xl px-4 lg:px-6 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 py-6">
        {/* Sidebar (layout aprovado: mantido) */}
        <aside className="pl-0 lg:pl-0">
          <div className="sticky top-[92px]">
            <div className="ml-4 lg:ml-4 rounded-2xl border bg-white shadow-sm p-4 flex flex-col h-[calc(100vh-140px)]">
              <div className="mb-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Operacional</p>
              </div>

              <div className="space-y-2 flex-1">
                {!isAuthed ? (
                  navItem("login", "Login", <Icon.user />)
                ) : (
                  <>
                    {navItem("create", "Cadastro rápido", <Icon.plus />)}
                    {navItem("list", "Listagem (Clientes & Ordens)", <Icon.list />)}
                    {navItem("dashboard", "Dashboard financeiro", <Icon.chart />)}

                    <div className="pt-4">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Administrativo
                      </p>
                    </div>

                    <button
                      disabled
                      className="w-full rounded-xl px-3 py-2 text-sm font-semibold flex items-center gap-2 border bg-slate-50 text-slate-400 cursor-not-allowed"
                      title="Em breve"
                    >
                      <Icon.lock />
                      Modelos de cálculo
                    </button>

                    <button
                      disabled
                      className="w-full rounded-xl px-3 py-2 text-sm font-semibold flex items-center gap-2 border bg-slate-50 text-slate-400 cursor-not-allowed"
                      title="Em breve"
                    >
                      <Icon.lock />
                      Controle de acesso
                    </button>
                  </>
                )}
              </div>

              {/* TEMP: Descanso / Repouso (remover ao final) */}
              <div className="mt-3">
                <RestTimer />
              </div>

              {/* Rodapé sidebar: Data/Hora + “Usuário” */}
              <div className="pt-3 border-t flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono">{clock.date}</span>
                <span className="font-mono">{clock.time}</span>
              </div>
              <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                <span>{isAuthed ? "Usuário logado" : "Em desenvolvimento"}</span>
                <span className="font-medium">{isAuthed ? auth.user?.nome || "—" : "—"}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="space-y-6">
          {!isAuthed && view === "login" && (
            <Card title="Login" subtitle="Entre com seu usuário e senha para acessar o sistema.">
              <div className="grid grid-cols-1 gap-4">
                <Input label="E-mail" value={loginEmail} onChange={setLoginEmail} placeholder="seu@email.com" />
                <Input
                  label="Senha"
                  value={loginSenha}
                  onChange={setLoginSenha}
                  placeholder="••••••••"
                />
                {loginError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {loginError}
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <PrimaryButton onClick={doLogin}>Entrar</PrimaryButton>
                </div>
              </div>
            </Card>
          )}

          {/* MÓDULOS (só authed) */}
          {isAuthed && view === "create" && (
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
                      <p className="text-xs text-slate-500">Dados principais para identificação e contato.</p>
                    </div>

                    <Input
                      label="CPF/CNPJ"
                      value={cpfCnpjMasked}
                      onChange={setCpfCnpj}
                      placeholder="Ex.: 111.222.333-44"
                      inputMode="numeric"
                      maxLength={18}
                      error={cpfCnpjMasked && !cpfCnpjValid ? "CPF/CNPJ inválido" : ""}
                      helper="Com máscara e validação."
                    />
                    <Input
                      label="Nome / Razão Social"
                      value={nomeRazaoSocial}
                      onChange={setNomeRazaoSocial}
                      placeholder="Ex.: Empresa X Ltda."
                    />
                    <Input label="E-mail" value={email} onChange={setEmail} placeholder="financeiro@empresa.com" />
                    <Input
                      label="Telefone"
                      value={telefoneMasked}
                      onChange={setTelefone}
                      placeholder="(99) 9 9999-9999"
                      inputMode="numeric"
                      error={!telefoneValid ? "Telefone inválido" : ""}
                      helper="Formato obrigatório: (99) 9 9999-9999"
                      maxLength={16}
                    />
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Ordem de Pagamento</h4>
                      <p className="text-xs text-slate-500">Detalhes do contrato/ocorrência vinculada ao cliente.</p>
                    </div>

                    <Input
                      label="Descrição / Objeto"
                      value={descricao}
                      onChange={setDescricao}
                      placeholder="Ex.: Contrato consultivo mensal"
                    />
                    <Input
                      label="Tipo de contrato"
                      value={tipoContrato}
                      onChange={setTipoContrato}
                      placeholder="Ex.: esporádico, recorrente..."
                    />
                    <Input
                      label="Valor total previsto"
                      value={valorDisplay}
                      onChange={setValorPrevistoRaw}
                      placeholder="Ex.: 10000"
                      inputMode="numeric"
                      helper="Digitando: 1→0,01 | 12→0,12 | 123→1,23 | 123456→1.234,56"
                    />
                    <Select
                      label="Modelo de pagamento"
                      value={modeloPagamento}
                      onChange={setModeloPagamento}
                      options={[
                        { value: "AVISTA", label: "À vista" },
                        { value: "ENTRADA_E_PARCELAS", label: "Entrada + parcelas" },
                        { value: "PARCELADO", label: "Parcelado" },
                      ]}
                    />
                    <Input
                      label="Data de início"
                      value={dataInicio}
                      onChange={setDataInicio}
                      placeholder="dd/mm/aaaa"
                      error={dataInicio && !dataInicioOk ? "Data inválida (DD/MM/AAAA)" : ""}
                      helper="Obrigatório: DD/MM/AAAA"
                    />

                    <div className="flex items-center gap-2 pt-2">
                      <PrimaryButton
                        onClick={saveClientAndOrder}
                        disabled={!cpfCnpjValid || !nomeRazaoSocial || !descricao || !dataInicioOk}
                      >
                        Salvar cliente + ordem
                      </PrimaryButton>
                      {saveMsg ? (
                        <span className="text-sm font-semibold text-slate-700">{saveMsg}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {isAuthed && view === "list" && (
            <Card
              title="Listagem (Clientes & Ordens)"
              subtitle="Valide rapidamente os cadastros feitos no Cadastro rápido."
              right={<SecondaryButton onClick={loadList}>Atualizar</SecondaryButton>}
            >
              {listErr ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {listErr}
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {listData.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum registro.</p>
                ) : (
                  listData.map((c) => (
                    <div key={c.id} className="rounded-2xl border bg-white p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{c.nomeRazaoSocial}</p>
                          <p className="text-xs text-slate-500">
                            {maskCpfCnpj(c.cpfCnpj)} • {c.email || "—"} • {maskPhone(c.telefone || "") || "—"}
                          </p>
                        </div>
                        <Badge tone="slate">{(c.ordens || []).length} ordem(ns)</Badge>
                      </div>

                      <div className="mt-3 space-y-2">
                        {(c.ordens || []).map((o) => (
                          <div key={o.id} className="rounded-xl bg-slate-50 border px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900">
                                #{o.sequenciaCliente} • {o.descricao}
                              </p>
                              <span className="text-xs font-semibold text-slate-600">
                                {o.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Modelo: {o.modeloPagamento} • Início:{" "}
                              {o.dataInicio ? formatDateBR(new Date(o.dataInicio)) : "—"} • Valor previsto:{" "}
                              {o.valorTotalPrevisto != null
                                ? `R$ ${Number(o.valorTotalPrevisto).toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`
                                : "—"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}

          {isAuthed && view === "dashboard" && (
            <Card
              title="Dashboard financeiro"
              subtitle="Visão geral inicial (protótipo)."
              right={<SecondaryButton onClick={loadDash}>Atualizar</SecondaryButton>}
            >
              {dashErr ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {dashErr}
                </div>
              ) : null}

              {!dash ? (
                <p className="text-sm text-slate-500">Carregando...</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        </main>
      </div>
    </div>
  );
}
