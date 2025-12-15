// frontend/src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, API_BASE, logoutHard } from "./lib/api";

// Logo (ajuste se teu caminho for outro)
let logoSrc;
try {
  logoSrc = new URL("./assets/logo.png", import.meta.url).href;
} catch {
  logoSrc = null;
}

// ======================
// Utils (datas/horas)
// ======================
function pad2(n) {
  return String(n).padStart(2, "0");
}
function nowClock() {
  const d = new Date();
  return {
    date: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`,
    hour: d.getHours(),
    minutes: d.getMinutes(),
    seconds: d.getSeconds(),
    ts: d.getTime(),
  };
}
function minutesOfDayFromHHMM(hhmm) {
  const [h, m] = String(hhmm || "").split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}
function formatMsToHMS(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}
function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

// ======================
// Ícones minimalistas (inline)
// ======================
const Icon = {
  dashboard: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" {...p}>
      <path
        d="M4 13h7V4H4v9Zm9 7h7V11h-7v9ZM4 20h7v-5H4v5Zm9-11h7V4h-7v5Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  ),
  pagamentos: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" {...p}>
      <path
        d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M7 10h10M7 14h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  repasses: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" {...p}>
      <path d="M7 7h10v10H7V7Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 10h4M10 14h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  historico: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" {...p}>
      <path
        d="M12 8v5l3 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 12a9 9 0 1 1-3-6.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  relatorios: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" {...p}>
      <path d="M7 3h10v18H7V3Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  advogados: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" {...p}>
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M4 20a8 8 0 0 1 16 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  clientes: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" {...p}>
      <path d="M4 7h16v12H4V7Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 10h16" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 14h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  config: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" {...p}>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M19.4 15a7.9 7.9 0 0 0 .1-1l2-1.5-2-3.5-2.4.6a7.4 7.4 0 0 0-1.7-1L14 6h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1L5.5 9 3.5 12.5 5.5 14a7.9 7.9 0 0 0 .1 1l-2 1.5 2 3.5 2.4-.6a7.4 7.4 0 0 0 1.7 1L10 22h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.4.6 2-3.5-2-1.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  ),
  logout: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" {...p}>
      <path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 12h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 8l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  moon: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" {...p}>
      <path
        d="M21 14.5A7.5 7.5 0 0 1 9.5 3a6.5 6.5 0 1 0 11.5 11.5Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  ),
  sun: (p) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" {...p}>
      <path
        d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  ),
};

// ======================
// Diretrizes “armário” (referência)
// ======================
// 1) CPF/CNPJ com máscara + validação onde aparecer/solicitar
// 2) Datas DD/MM/AAAA
// 3) Horas HH:MM:SS
// 4) Valores (R$) com máscara digitando 1->0,01 ... e exibindo 1.234,56
// 5) Layouts aprovados imutáveis (liberado aqui para nova sidebar)
// 6) Novas diretrizes serão adicionadas
// 7) Telefone (99) 9 9999-9999 com máscara/validação onde aparecer/solicitar

// ======================
// UI básicos
// ======================
function Card({ title, subtitle, right, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}
function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
  };
  return <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-xs", tones[tone])}>{children}</span>;
}
function Button({ children, onClick, variant = "primary", disabled }) {
  const v = {
    primary:
      "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-600",
    secondary:
      "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 disabled:opacity-60",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100 disabled:opacity-60",
    danger:
      "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300 disabled:text-rose-100",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx("rounded-xl px-4 py-2 text-sm font-semibold transition", v[variant])}
    >
      {children}
    </button>
  );
}
function Input({ label, value, onChange, type = "text", placeholder, autoComplete, onKeyDown }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      <input
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
        value={value}
        onChange={onChange}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onKeyDown={onKeyDown}
      />
    </label>
  );
}

// ======================
// Descanso (preservado)
// ======================
function useRestControl() {
  const KEY = "amr_rest_time_hhmm";
  const [hhmm, setHhmm] = useState(() => localStorage.getItem(KEY) || "");
  const [modal, setModal] = useState({ open: false, stage: "arrived" }); // arrived | postpone | bye
  const [clock, setClock] = useState(() => nowClock());
  const tRef = useRef(null);

  useEffect(() => {
    tRef.current = setInterval(() => setClock(nowClock()), 1000);
    return () => clearInterval(tRef.current);
  }, []);

  useEffect(() => {
    if (hhmm) localStorage.setItem(KEY, hhmm);
    else localStorage.removeItem(KEY);
  }, [hhmm]);

  const targetMin = minutesOfDayFromHHMM(hhmm);
  const nowMin = clock.hour * 60 + clock.minutes;

  const msLeft = useMemo(() => {
    if (targetMin === null) return null;
    const targetToday = new Date();
    targetToday.setHours(Math.floor(targetMin / 60), targetMin % 60, 0, 0);
    let diff = targetToday.getTime() - clock.ts;
    // se já passou hoje, considera amanhã
    if (diff < 0) {
      targetToday.setDate(targetToday.getDate() + 1);
      diff = targetToday.getTime() - clock.ts;
    }
    return diff;
  }, [targetMin, clock.ts]);

  // dispara modal quando bate a hora (janela de 1s)
  useEffect(() => {
    if (!hhmm || targetMin === null) return;
    // chegou se agora == target (por minuto e segundo ~ 0..2)
    if (nowMin === targetMin && clock.seconds <= 2) {
      setModal({ open: true, stage: "arrived" });
    }
  }, [hhmm, targetMin, nowMin, clock.seconds]);

  const isNight = useMemo(() => clock.hour >= 18 || clock.hour < 6, [clock.hour]);

  return {
    hhmm,
    setHhmm,
    msLeft,
    modal,
    setModal,
    isNight,
    clock,
  };
}

// ======================
// App
// ======================
export default function App() {
  const [clock, setClock] = useState(() => nowClock());
  useEffect(() => {
    const id = setInterval(() => setClock(nowClock()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auth state
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("token") || "";
    const userRaw = localStorage.getItem("user");
    const user = userRaw ? JSON.parse(userRaw) : null;
    return { token, user, loading: false, error: "" };
  });

  const isAuthed = !!auth.token;

  // escuta logout forçado do api.js
  useEffect(() => {
    const onLogout = () => setAuth({ token: "", user: null, loading: false, error: "" });
    window.addEventListener("amr:logout", onLogout);
    return () => window.removeEventListener("amr:logout", onLogout);
  }, []);

  // “view-based navigation”
  const [view, setView] = useState(() => (isAuthed ? "dashboard" : "login"));

  // Carrega /me quando tiver token
  useEffect(() => {
    if (!auth.token) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await apiFetch("/auth/me");
        if (cancelled) return;
        localStorage.setItem("user", JSON.stringify(me));
        setAuth((p) => ({ ...p, user: me, error: "" }));
      } catch (e) {
        if (cancelled) return;
        setAuth({ token: "", user: null, loading: false, error: e?.message || "Sessão inválida." });
        setView("login");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token]);

  // Login
  const [loginForm, setLoginForm] = useState({ email: "", senha: "" });
  const [loginState, setLoginState] = useState({ loading: false, error: "" });

  async function doLogin() {
    setLoginState({ loading: true, error: "" });
    try {
      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginForm.email, senha: loginForm.senha }),
      });

      const ct = (resp.headers.get("content-type") || "").toLowerCase();
      const raw = await resp.text();
      const data = ct.includes("application/json") ? (raw ? JSON.parse(raw) : {}) : { message: raw };

      if (!resp.ok) throw new Error(data?.message || "Erro no login.");

      const token = data?.token;
      const user = data?.user || null;

      if (!token) throw new Error("Login ok, mas não retornou token.");

      localStorage.setItem("token", token);
      if (user) localStorage.setItem("user", JSON.stringify(user));

      setAuth({ token, user, loading: false, error: "" });
      setView("dashboard");
      setLoginState({ loading: false, error: "" });
    } catch (e) {
      setLoginState({ loading: false, error: e?.message || "Erro no login." });
    }
  }

  function doLogout() {
    logoutHard();
    setAuth({ token: "", user: null, loading: false, error: "" });
    setView("login");
  }

  const role = auth.user?.role || "USER"; // fallback

  // ========= PERMISSÕES =========
  const PERMS = useMemo(() => {
    return {
      // User-only set
      USER: new Set(["dashboard", "repasses", "historico", "relatorios", "login"]),
      // Admin full
      ADMIN: new Set([
        "dashboard",
        "pagamentos",
        "repasses",
        "advogados",
        "clientes",
        "historico",
        "relatorios",
        "config",
        // mapeamentos antigos (mantidos)
        "create",
        "list",
        "login",
      ]),
    };
  }, []);

  const canAccess = useMemo(() => {
    const set = PERMS[role] || PERMS.USER;
    return set.has(view);
  }, [PERMS, role, view]);

  // Tela “não autorizado” com 5s e retorno Dashboard
  const [denyTick, setDenyTick] = useState(5);
  useEffect(() => {
    if (!isAuthed) return;
    if (view === "login") return;
    if (canAccess) return;

    setDenyTick(5);
    const id = setInterval(() => setDenyTick((p) => p - 1), 1000);
    const t = setTimeout(() => setView("dashboard"), 5000);

    return () => {
      clearInterval(id);
      clearTimeout(t);
    };
  }, [canAccess, isAuthed, view]);

  // ========= Sidebar model =========
  const menuAdmin = useMemo(
    () => [
      { key: "dashboard", label: "Dashboard", icon: Icon.dashboard, section: "Operacional" },
      { key: "pagamentos", label: "Pagamentos", icon: Icon.pagamentos, section: "Operacional" },
      { key: "repasses", label: "Repasses", icon: Icon.repasses, section: "Operacional" },
      { key: "advogados", label: "Advogados", icon: Icon.advogados, section: "Administrativo" },
      { key: "clientes", label: "Clientes", icon: Icon.clientes, section: "Administrativo" },
      { key: "historico", label: "Histórico", icon: Icon.historico, section: "Administrativo" },
      { key: "relatorios", label: "Relatórios", icon: Icon.relatorios, section: "Administrativo" },
      { key: "config", label: "Configurações", icon: Icon.config, section: "Administrativo" },
    ],
    []
  );

  const menuUser = useMemo(
    () => [
      { key: "dashboard", label: "Dashboard", icon: Icon.dashboard, section: "Operacional" },
      { key: "repasses", label: "Repasses", icon: Icon.repasses, section: "Operacional" },
      { key: "historico", label: "Histórico", icon: Icon.historico, section: "Operacional" },
      { key: "relatorios", label: "Relatórios", icon: Icon.relatorios, section: "Operacional" },
    ],
    []
  );

  const menu = role === "ADMIN" ? menuAdmin : menuUser;

  // compat: mapeia “Pagamentos/Clientes” para telas antigas existentes
  useEffect(() => {
    if (view === "pagamentos") setView("create");
    if (view === "clientes") setView("list");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // ========= Descanso =========
  const rest = useRestControl();

  // ======================
  // PLACEHOLDERS (novos módulos)
  // ======================
  const Placeholder = ({ title, subtitle }) => (
    <Card
      title={title}
      subtitle={subtitle}
      right={<Badge tone="amber">Em desenvolvimento</Badge>}
    >
      <p className="text-sm text-slate-600">
        Módulo preparado na navegação. Agora a gente constrói com dados e permissões reais.
      </p>
    </Card>
  );

  // ======================
  // Render
  // ======================
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        {/* SIDEBAR */}
        <aside className="w-[270px] shrink-0">
          <div className="h-screen sticky top-0 flex flex-col">
            <div className="h-full bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 px-4 py-5">
              {/* Brand */}
              <div className="flex items-center gap-3 px-2">
                <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center overflow-hidden">
                  {logoSrc ? <img src={logoSrc} alt="AMR" className="h-7 w-auto opacity-95" /> : <span className="text-xs">AMR</span>}
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold tracking-wide">AMR Advogados</div>
                  <div className="text-xs text-slate-400">Controles</div>
                </div>
              </div>

              {/* Sections */}
              <div className="mt-7 space-y-6">
                {["Operacional", "Administrativo"].map((sec) => {
                  const items = menu.filter((m) => m.section === sec);
                  if (items.length === 0) return null;
                  return (
                    <div key={sec}>
                      <div className="px-2 text-[11px] uppercase tracking-wider text-slate-400">
                        {sec}
                      </div>
                      <div className="mt-2 space-y-1">
                        {items.map((it) => {
                          const active =
                            (view === it.key) ||
                            (it.key === "pagamentos" && view === "create") ||
                            (it.key === "clientes" && view === "list");
                          const Ico = it.icon;
                          return (
                            <button
                              key={it.key}
                              onClick={() => setView(it.key)}
                              className={cx(
                                "w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                                active
                                  ? "bg-white/10 text-white"
                                  : "text-slate-300 hover:bg-white/5 hover:text-white"
                              )}
                            >
                              <span className={cx("opacity-90", active ? "text-white" : "text-slate-300")}>
                                <Ico />
                              </span>
                              <span className="truncate">{it.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer area */}
              <div className="mt-auto pt-6 space-y-4">
                {/* Descanso */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-300 font-semibold">Descanso</div>
                    <div className="text-slate-200">
                      {rest.isNight ? <Icon.moon /> : <Icon.sun />}
                    </div>
                  </div>

                  <div className="mt-2">
                    <label className="block text-[11px] text-slate-400 mb-1">Hora</label>
                    <input
                      type="time"
                      value={rest.hhmm}
                      onChange={(e) => rest.setHhmm(e.target.value)}
                      className="w-full rounded-xl bg-slate-950/40 border border-white/10 px-3 py-2 text-sm text-slate-100 outline-none focus:border-white/30"
                    />
                  </div>

                  <div className="mt-2 text-[11px] text-slate-300 flex items-center justify-between">
                    <span>Faltam</span>
                    <span className="font-mono">
                      {rest.msLeft === null ? "--:--:--" : formatMsToHMS(rest.msLeft)}
                    </span>
                  </div>
                </div>

                {/* User + clock + logout */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>{clock.date}</span>
                    <span className="font-mono">{clock.time}</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs text-slate-400">Usuário</div>
                    <Badge tone={isAuthed ? "green" : "amber"}>
                      {isAuthed ? role : "Sem sessão"}
                    </Badge>
                  </div>

                  <div className="mt-3">
                    <button
                      className={cx(
                        "w-full rounded-xl px-3 py-2 text-sm font-semibold flex items-center justify-center gap-2 transition",
                        isAuthed ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-white/10 text-slate-400 cursor-not-allowed"
                      )}
                      onClick={isAuthed ? doLogout : undefined}
                      disabled={!isAuthed}
                    >
                      <Icon.logout />
                      Sair
                    </button>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 px-1">
                  Token via Authorization: Bearer (temporário).
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 px-6 py-6">
          {/* LOGIN */}
          {view === "login" && (
            <div className="max-w-2xl">
              <Card
                title="Login"
                subtitle="Entre com seu usuário e senha para acessar o sistema."
                right={<Badge tone="slate">API {API_BASE.replace(/^https?:\/\//, "")}</Badge>}
              >
                {loginState.error && (
                  <p className="mb-3 text-sm text-rose-700">{loginState.error}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="E-mail"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="financeiro@amandaramalho.adv.br"
                    autoComplete="username"
                  />
                  <Input
                    label="Senha"
                    type="password"
                    value={loginForm.senha}
                    onChange={(e) => setLoginForm((p) => ({ ...p, senha: e.target.value }))}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") doLogin();
                    }}
                  />
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <Button onClick={doLogin} disabled={loginState.loading}>
                    {loginState.loading ? "Entrando..." : "Entrar"}
                  </Button>
                  <span className="text-xs text-slate-500">
                    Se der erro “token &lt;DOCTYPE”, confira `VITE_API_BASE` na Vercel.
                  </span>
                </div>
              </Card>
            </div>
          )}

          {/* BLOQUEIO: precisa estar authed */}
          {!isAuthed && view !== "login" && (
            <div className="max-w-2xl">
              <Card
                title="Acesso restrito"
                subtitle="Você precisa estar autenticado para acessar o sistema."
                right={<Badge tone="amber">Login necessário</Badge>}
              >
                <Button onClick={() => setView("login")}>Ir para Login</Button>
              </Card>
            </div>
          )}

          {/* BLOQUEIO: não autorizado */}
          {isAuthed && view !== "login" && !canAccess && (
            <div className="max-w-2xl">
              <Card
                title="Acesso não autorizado"
                subtitle={`Você não tem permissão para acessar este módulo. Voltando ao Dashboard em ${denyTick}s...`}
                right={<Badge tone="red">Bloqueado</Badge>}
              >
                <div className="flex gap-2">
                  <Button onClick={() => setView("dashboard")}>Voltar agora</Button>
                </div>
              </Card>
            </div>
          )}

          {/* CONTEÚDO: só renderiza se authed + permitido */}
          {isAuthed && canAccess && (
            <>
              {/* EXISTENTES (mantidos) */}
              {view === "create" && (
                <Placeholder
                  title="Pagamentos"
                  subtitle="(por enquanto) aponta para o Cadastro rápido Cliente + Ordem que você já tinha."
                />
              )}

              {view === "list" && (
                <Placeholder
                  title="Clientes"
                  subtitle="(por enquanto) aponta para a Listagem Clientes & Ordens existente."
                />
              )}

              {view === "dashboard" && (
                <Placeholder
                  title="Dashboard"
                  subtitle={role === "USER" ? "Mostrará apenas seus dados (backend vai filtrar)." : "Visão total do Admin."}
                />
              )}

              {/* NOVOS (planejados) */}
              {view === "repasses" && (
                <Placeholder title="Repasses" subtitle="Aqui entra o módulo de repasses (por usuário/advogado)." />
              )}

              {view === "historico" && (
                <Placeholder title="Histórico" subtitle="Vamos definir a finalidade e modelar com calma." />
              )}

              {view === "relatorios" && (
                <Placeholder title="Relatórios" subtitle="USER: só os próprios. ADMIN: tudo. Depois PDF bonito AMR." />
              )}

              {view === "advogados" && role === "ADMIN" && (
                <Placeholder title="Advogados" subtitle="Cadastro e vínculos para modelos de distribuição." />
              )}

              {view === "config" && role === "ADMIN" && (
                <Placeholder title="Configurações" subtitle="Gestão de usuários: listar, ativar/desativar, reset senha." />
              )}
            </>
          )}
        </main>
      </div>

      {/* MODAL DESCANSO */}
      {rest.modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-6">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200">
            {rest.modal.stage === "arrived" && (
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                    {rest.isNight ? <Icon.moon /> : <Icon.sun />}
                  </div>
                  <div>
                    <div className="text-base font-semibold text-slate-900">
                      Chegou a hora escolhida.
                    </div>
                    <div className="text-sm text-slate-600">
                      Você deve ir descansar agora.
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex gap-2 justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => rest.setModal({ open: true, stage: "postpone" })}
                  >
                    Postergar
                  </Button>
                  <Button
                    onClick={() => rest.setModal({ open: true, stage: "bye" })}
                  >
                    Vou descansar
                  </Button>
                </div>
              </div>
            )}

            {rest.modal.stage === "postpone" && (
              <div className="p-6">
                <div className="text-base font-semibold text-slate-900">Postergar descanso</div>
                <div className="text-sm text-slate-600 mt-1">
                  Informe a nova hora.
                </div>

                <div className="mt-4">
                  <input
                    type="time"
                    value={rest.hhmm}
                    onChange={(e) => rest.setHhmm(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div className="mt-5 flex gap-2 justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => rest.setModal({ open: false, stage: "arrived" })}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => rest.setModal({ open: false, stage: "arrived" })}
                  >
                    Confirmar
                  </Button>
                </div>
              </div>
            )}

            {rest.modal.stage === "bye" && (
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                    {rest.isNight ? <Icon.moon /> : <Icon.sun />}
                  </div>
                  <div>
                    <div className="text-base font-semibold text-slate-900">
                      {rest.isNight ? "Boa noite." : "Bom descanso."}
                    </div>
                    <div className="text-sm text-slate-600">
                      Quando voltar, clique em retornar para liberar a tela.
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <Button onClick={() => rest.setModal({ open: false, stage: "arrived" })}>
                    Retornar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
