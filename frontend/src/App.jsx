import React, { useEffect, useMemo, useState } from "react";
import RestTimer from "./components/RestTimer";
import { useLocation, useNavigate } from "react-router-dom";
import logoSrc from "./assets/logo.png";

import { apiFetch, setAuth, clearAuth, getToken, getUser } from "./lib/api";

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
  const v = onlyDigits(value).slice(0, 11);
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
  return n; // centavos
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
  wallet: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16v12H4V7Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 9h16" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 14h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  briefcase: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M8 7V5h8v2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 7h16v14H4V7Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  users: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M16 13c-2.8 0-5 1.4-5 3v1h10v-1c0-1.6-2.2-3-5-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M8 13c-2.8 0-5 1.4-5 3v1h8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  folder: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h6l2 2h8v10H4V7Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
  clock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  settings: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 15a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M19.4 15a7.6 7.6 0 0 0 .1-1 7.6 7.6 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a8 8 0 0 0-1.7-1l-.3-2.6H10l-.3 2.6a8 8 0 0 0-1.7 1l-2.4-1-2 3.4L5.6 13a7.6 7.6 0 0 0-.1 1 7.6 7.6 0 0 0 .1 1l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 1.7 1l.3 2.6h4l.3-2.6a8 8 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
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

  // Admin-only
  PAGAMENTOS: "pagamentos",
  REPASSES: "repasses",
  ADVOGADOS: "advogados",
  CLIENTES: "clientes",

  // Both
  HISTORICO: "historico",
  REPORTS: "reports",

  // Admin-only
  SETTINGS: "settings",
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Auth state (SINGLE SOURCE: api.js localStorage keys)
  const [auth, setAuthState] = useState(() => ({
    token: getToken(),
    user: getUser(),
  }));

  const isAuthed = Boolean(auth?.token);
  const isAdmin = auth?.user?.role === "ADMIN";

  // View selection
  const [view, setView] = useState(() => {
    const p = new URLSearchParams(location.search);
    return p.get("view") || (isAuthed ? VIEWS.DASH : VIEWS.LOGIN);
  });

  // Clock
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

  // backend health
  const [backendOk, setBackendOk] = useState("verificando...");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await apiFetch("/health", { method: "GET" });
        if (alive) setBackendOk("ok");
      } catch {
        if (alive) setBackendOk("erro");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const moduleName = useMemo(() => {
    const map = {
      [VIEWS.LOGIN]: "Login",
      [VIEWS.DASH]: "Dashboard",
      [VIEWS.PAGAMENTOS]: "Pagamentos",
      [VIEWS.REPASSES]: "Repasses",
      [VIEWS.ADVOGADOS]: "Advogados",
      [VIEWS.CLIENTES]: "Clientes",
      [VIEWS.HISTORICO]: "Histórico",
      [VIEWS.REPORTS]: "Relatórios",
      [VIEWS.SETTINGS]: "Configurações",
    };
    return map[view] || "Módulo";
  }, [view]);

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
    setView(VIEWS.LOGIN);
  }

  // nav item renderer
  function navItem(key, label, icon, opts = {}) {
    const active = view === key;
    const disabled = Boolean(opts.disabled);

    // Ativo: claro + texto escuro | Inativo: escuro + texto claro
    return (
      <button
        type="button"
        onClick={() => !disabled && go(key)}
        disabled={disabled}
        title={opts.title || ""}
        className={cx(
          "w-full rounded-xl px-3 py-2 text-sm font-semibold flex items-center gap-2 border transition-colors",
          disabled
            ? "bg-white/5 text-white/35 border-white/10 cursor-not-allowed"
            : active
            ? "bg-white text-[#081A33] border-white/70"
            : "bg-white/10 text-white border-white/10 hover:bg-white/15"
        )}
      >
        <span className={cx("inline-flex", disabled ? "text-white/30" : active ? "text-[#081A33]" : "text-white/80")}>
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
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: { email: loginEmail, senha: loginSenha },
      });

      setAuth(data.token, data.user);
      setAuthState({ token: data.token, user: data.user });

      setView(VIEWS.DASH);
    } catch (e) {
      setLoginError(e?.message || "Erro no login");
    } finally {
      setLoginLoading(false);
    }
  }

  // Se deslogar, força view login
  useEffect(() => {
    if (!isAuthed && view !== VIEWS.LOGIN) setView(VIEWS.LOGIN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  function DevPlaceholder({ title, subtitle }) {
    return (
      <Card
        title={title}
        subtitle={subtitle || "Em desenvolvimento. Vamos implementar este módulo no próximo ciclo."}
        right={<Badge tone="slate">Em breve</Badge>}
      >
        <div className="text-sm text-slate-600">
          Esse é um placeholder proposital para manter navegação/UX estáveis enquanto evoluímos o app.
        </div>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar fixa */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 w-[280px] bg-[#081A33] text-white flex flex-col",
          // ✅ Ajuste #5: cantos arredondados "como botões" (sem deslocar da esquerda)
          "rounded-r-2xl"
        )}
      >
        {/* Marca */}
        <div className="px-6 pt-6 pb-4 flex flex-col items-center">
          <div className="rounded-2xl bg-white/95 p-3 shadow-sm">
            {/* ✅ Ajuste #1 (LOGO):
                - mude a classe abaixo (h-7/h-8/h-9...) para testar a altura ideal.
                - Ex.: "h-7" menor; "h-10" maior.
            */}
            <img src={logoSrc} alt="AMR" className="h-8 w-auto" />
          </div>

          {/* ✅ Ajuste #4 (AMR Advogados): maior */}
        {/*  <p className="mt-3 text-2xl font-semibold tracking-wide text-white">AMR Advogados</p> */}
        </div>

        {/* Navegação (sem headers Operacional/Administrativo) */}
        <div className="px-4 flex-1 overflow-hidden flex flex-col">
          <div className="space-y-2">
            {!isAuthed ? (
              navItem(VIEWS.LOGIN, "Login", <Icon.user />)
            ) : !isAdmin ? (
              <>
                {navItem(VIEWS.DASH, "Dashboard", <Icon.chart />)}
                {navItem(VIEWS.REPASSES, "Repasses", <Icon.briefcase />)}
                {navItem(VIEWS.HISTORICO, "Histórico", <Icon.clock />)}
                {navItem(VIEWS.REPORTS, "Relatórios", <Icon.shield />)}
              </>
            ) : (
              <>
                {navItem(VIEWS.DASH, "Dashboard", <Icon.chart />)}
                {navItem(VIEWS.PAGAMENTOS, "Pagamentos", <Icon.wallet />)}
                {navItem(VIEWS.REPASSES, "Repasses", <Icon.briefcase />)}
                {navItem(VIEWS.ADVOGADOS, "Advogados", <Icon.users />)}
                {navItem(VIEWS.CLIENTES, "Clientes", <Icon.folder />)}
                {navItem(VIEWS.HISTORICO, "Histórico", <Icon.clock />)}
                {navItem(VIEWS.REPORTS, "Relatórios", <Icon.shield />)}
                {navItem(VIEWS.SETTINGS, "Configurações", <Icon.settings />)}
              </>
            )}
          </div>

          {/* espaço elástico para empurrar o rodapé e garantir sidebar sempre toda visível */}
          <div className="flex-1" />
        </div>

        {/* Rodapé da sidebar: Descanso + usuário + data/hora + sair */}
        <div className="px-4 pb-4 space-y-3">
          {/* Descanso (mantém!) */}
          {/* <RestTimer /> */}

          {/* ✅ Ajuste #3a: +2 pts (text-sm) */}
          <div className="text-sm text-white/80 flex items-center justify-between">
            <span className="truncate max-w-[170px]">{auth?.user?.nome || (isAuthed ? "—" : "Em desenvolvimento")}</span>
            <span className="font-semibold">{auth?.user?.role || (isAuthed ? "—" : "—")}</span>
          </div>

          {/* ✅ Ajuste #3b: +2 pts (text-sm) */}
          <div className="text-sm text-white/70 flex items-center justify-between font-mono">
            <span>{clock.date}</span>
            <span>{clock.time}</span>
          </div>

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
          {/* Cabeçalho interno */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">{moduleName}</p>
              <p className="text-xs text-slate-500">Controle de recebimentos, repasses e obrigações internas</p>
            </div>
            <Badge tone={backendOk === "ok" ? "green" : backendOk === "erro" ? "red" : "slate"}>
              {backendOk === "ok" ? "Backend: ok" : backendOk === "erro" ? "Backend: erro" : "Backend: verificando..."}
            </Badge>
          </div>

          {!isAuthed && view === VIEWS.LOGIN && (
            <Card title="Login" subtitle="Entre com seu usuário e senha para acessar o sistema.">
              <div className="grid grid-cols-1 gap-4">
                <Input label="E-mail" value={loginEmail} onChange={setLoginEmail} placeholder="seu@email.com" />
                <Input label="Senha" value={loginSenha} onChange={setLoginSenha} placeholder="••••••••" type="password" />

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

          {isAuthed && view === VIEWS.DASH && (
            <DevPlaceholder
              title="Dashboard"
              subtitle={isAdmin ? "Visão geral (Admin). Depois segmentamos por usuário." : "Somente seus dados (User)."}
            />
          )}

          {isAuthed && view === VIEWS.PAGAMENTOS && (
            <DevPlaceholder title="Pagamentos" subtitle="Cadastro/baixa de pagamentos efetuados pelos clientes." />
          )}

          {isAuthed && view === VIEWS.REPASSES && (
            <DevPlaceholder title="Repasses" subtitle={isAdmin ? "Admin vê tudo." : "User verá apenas seus repasses."} />
          )}

          {isAuthed && view === VIEWS.ADVOGADOS && <DevPlaceholder title="Advogados" subtitle="Cadastro e gestão dos advogados do escritório." />}

          {isAuthed && view === VIEWS.CLIENTES && <DevPlaceholder title="Clientes" subtitle="Cadastro e gestão de clientes." />}

          {isAuthed && view === VIEWS.HISTORICO && <DevPlaceholder title="Histórico" subtitle="Vamos definir o escopo deste módulo." />}

          {isAuthed && view === VIEWS.REPORTS && (
            <DevPlaceholder title="Relatórios" subtitle={isAdmin ? "Admin vê tudo." : "User verá apenas seus dados."} />
          )}

          {isAuthed && view === VIEWS.SETTINGS && (
            <DevPlaceholder title="Configurações" subtitle="Gestão de usuários, modelos de cálculo, parâmetros, etc." />
          )}
        </div>
      </main>
    </div>
  );
}
