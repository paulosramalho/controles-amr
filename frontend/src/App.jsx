// frontend/src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import logoSrc from "./assets/logo.png";

import RestTimer from "./components/RestTimer";
import { apiFetch, setAuth, clearAuth, getToken, getUser } from "./lib/api";

/** =========================
 *  HELPERS — DIRETRIZES
 *  ========================= */
function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

// Datas DD/MM/AAAA
function formatDateDDMMYYYY(date) {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Horas HH:MM:SS
function formatTimeHHMMSS(date) {
  const d = new Date(date);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
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

const VIEWS = {
  LOGIN: "login",
  DASH: "dashboard",
  PAGAMENTOS: "pagamentos",
  REPASSES: "repasses",
  ADVOGADOS: "advogados",
  CLIENTES: "clientes",
  HISTORICO: "historico",
  REPORTS: "reports",
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
          "fixed inset-y-0 left-0 w-[280px] bg-white text-slate-800 flex flex-col",
          "rounded-r-2xl"
        )}
      >
        {/* Marca */}
        <div className="px-6 pt-6 pb-4 flex flex-col items-center">
          <div className="rounded-2xl bg-white/95 p-3 shadow-sm">
            {/* ✅ LOGO:
                - mude a classe abaixo (h-5/h-6/h-7/h-8...) para testar a altura ideal.
                - Ex.: "h-5" menor; "h-8" maior.
            */}
            <img src={logoSrc} alt="AMR" className="h-5 w-auto" />
          </div>

          {/* (COMENTADO) "AMR Advogados" abaixo da logo — como você pediu */}
          {/*
          <p className="mt-3 text-lg font-semibold tracking-wide text-white">
            AMR Advogados
          </p>
          */}

          <p className="mt-3 text-base font-semibold tracking-wide text-slate-800">Pagamentos e Repasses</p>
        </div>

        {/* Navegação */}
        <div className="px-4 flex-1 overflow-y-auto overflow-x-hidden pb-2">
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
        </div>

        {/* Rodapé */}
<div className="px-4 pb-4 space-y-3">
  <div className="text-sm text-slate-600 flex items-center justify-between">
    <span className="truncate max-w-[170px]">
      {auth?.user?.nome || (isAuthed ? "—" : "Em desenvolvimento")}
    </span>
    <span className="font-semibold">
      {auth?.user?.role || "—"}
    </span>
  </div>

  <div className="text-xs text-slate-500 flex items-center justify-between">
    <span>{clock?.date}</span>
    <span className="font-mono">{clock?.time}</span>
  </div>

  <button
    type="button"
    onClick={logout}
    className="w-full rounded-xl bg-slate-900 text-white py-2 text-sm font-semibold hover:bg-slate-800 transition"
  >
    Sair
  </button>
</div>

