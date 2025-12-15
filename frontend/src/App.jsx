import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { api } from "./lib/api";

// ===== Logo (se existir em src/assets/logo.png) =====
let logoSrc = null;
try {
  logoSrc = new URL("./assets/logo.png", import.meta.url).href;
} catch {
  logoSrc = null;
}

// ===== Utils: clock + format =====
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n) => String(n).padStart(2, "0");
  const d = now;
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    hour: d.getHours(),
  };
}

// ===== Auth storage =====
const LS_TOKEN = "amr_token";
const LS_ROLE = "amr_role";
const LS_USER = "amr_user"; // string (nome/email) por enquanto

function readAuth() {
  const token = localStorage.getItem(LS_TOKEN) || "";
  const role = localStorage.getItem(LS_ROLE) || "";
  const user = localStorage.getItem(LS_USER) || "";
  return { token, role, user };
}
function writeAuth({ token, role, user }) {
  if (token) localStorage.setItem(LS_TOKEN, token);
  if (role) localStorage.setItem(LS_ROLE, role);
  if (user) localStorage.setItem(LS_USER, user);
}
function clearAuth() {
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_ROLE);
  localStorage.removeItem(LS_USER);
}

// ===== Role helpers =====
const ROLE = {
  ADMIN: "ADMIN",
  USER: "USER",
};
function hasRole(currentRole, allowed) {
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(currentRole);
}

// ===== ProtectedRoute (se você já usa um componente externo, pode trocar) =====
function ProtectedRoute({ children }) {
  const auth = readAuth();
  const loc = useLocation();
  if (!auth.token) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

// ===== RoleRoute (novo gate) =====
function RoleRoute({ allowedRoles, children }) {
  const auth = readAuth();
  const loc = useLocation();
  if (!auth.token) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;

  if (!hasRole(auth.role, allowedRoles)) {
    return <Navigate to="/nao-autorizado" replace state={{ from: loc.pathname }} />;
  }
  return children;
}

// ===== Acesso não autorizado (mostra 5s e volta) =====
function AcessoNaoAutorizado() {
  const nav = useNavigate();
  const { state } = useLocation();
  const from = state?.from || "rota";
  useEffect(() => {
    const t = setTimeout(() => nav("/dashboard", { replace: true }), 5000);
    return () => clearTimeout(t);
  }, [nav]);
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm p-6">
        <div className="text-lg font-semibold text-slate-900">Acesso não autorizado</div>
        <div className="mt-2 text-sm text-slate-600">
          Você não tem permissão para acessar <span className="font-medium">{from}</span>.
          <br />
          Voltando para o Dashboard em <span className="font-medium">5s</span>…
        </div>
        <button
          className="mt-5 w-full rounded-xl bg-slate-900 text-white py-2.5 text-sm font-medium hover:bg-slate-800"
          onClick={() => nav("/dashboard", { replace: true })}
        >
          Ir agora
        </button>
      </div>
    </div>
  );
}

// ===== Descanso (TEMPORÁRIO – remover ao final) =====
function DescansoWidget() {
  // Tudo aqui é temporário e será removido ao final.
  // Objetivo: input com "hora de descansar" e contador regressivo, com modal ao chegar.
  const { date, time, hour } = useClock();
  const [restTime, setRestTime] = useState(() => localStorage.getItem("amr_rest_time") || "");
  const [showModal, setShowModal] = useState(false);
  const [postpone, setPostpone] = useState(false);
  const [newTime, setNewTime] = useState("");

  const now = useMemo(() => new Date(), [time]); // recalcula a cada tick
  const target = useMemo(() => {
    if (!restTime) return null;
    const [hh, mm] = restTime.split(":").map((x) => parseInt(x, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    return d;
  }, [restTime]);

  const diffMs = useMemo(() => {
    if (!target) return null;
    return target.getTime() - now.getTime();
  }, [target, now]);

  const countdown = useMemo(() => {
    if (diffMs == null) return "";
    const ms = Math.max(0, diffMs);
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }, [diffMs]);

  // Ícone: lua de noite / sol de dia (só UI)
  const isNight = hour >= 18 || hour < 6;

  useEffect(() => {
    if (!restTime || !target) return;
    localStorage.setItem("amr_rest_time", restTime);

    // disparo do modal quando chegar
    if (diffMs != null && diffMs <= 0) setShowModal(true);
  }, [restTime, target, diffMs]);

  function applyPostpone() {
    if (!newTime) return;
    setRestTime(newTime);
    setNewTime("");
    setPostpone(false);
    setShowModal(false);
  }

  const greeting = isNight ? "Boa noite" : "Hora de dar uma pausa";

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 backdrop-blur p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{isNight ? "🌙" : "☀️"}</span>
          <div className="text-sm font-semibold text-slate-900">Descanso</div>
        </div>
        <div className="text-xs text-slate-500">
          {date} · {time}
        </div>
      </div>

      <label className="mt-3 block text-xs font-medium text-slate-600">Hora de descansar</label>
      <input
        type="time"
        value={restTime}
        onChange={(e) => setRestTime(e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
      />

      <div className="mt-3 text-sm text-slate-700">
        <div>
          <span className="text-slate-500">Hora escolhida:</span>{" "}
          <span className="font-medium">{restTime || "—"}</span>
        </div>
        <div className="mt-1">
          <span className="text-slate-500">Contagem regressiva:</span>{" "}
          <span className="font-semibold tabular-nums">{restTime ? countdown : "—"}</span>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => {}} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-6">
            <div className="text-lg font-semibold text-slate-900">{greeting}!</div>
            <div className="mt-2 text-sm text-slate-600">
              Chegou a hora escolhida. Você deve ir descansar agora.
            </div>

            {!postpone ? (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  className="rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium hover:bg-slate-50"
                  onClick={() => setPostpone(true)}
                >
                  Postergar
                </button>
                <button
                  className="rounded-xl bg-slate-900 text-white py-2.5 text-sm font-medium hover:bg-slate-800"
                  onClick={() => setShowModal(false)}
                >
                  Vou descansar
                </button>
              </div>
            ) : (
              <div className="mt-5">
                <label className="block text-xs font-medium text-slate-600">Nova hora</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    className="rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium hover:bg-slate-50"
                    onClick={() => {
                      setPostpone(false);
                      setNewTime("");
                      setShowModal(true); // volta para o modal principal
                    }}
                  >
                    Voltar
                  </button>
                  <button
                    className="rounded-xl bg-slate-900 text-white py-2.5 text-sm font-medium hover:bg-slate-800"
                    onClick={applyPostpone}
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            )}

            <button
              className="mt-4 w-full rounded-xl border border-slate-200 bg-white py-2 text-sm hover:bg-slate-50"
              onClick={() => setShowModal(false)}
            >
              Retornar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Layout / Sidebar =====
function Sidebar({ current, role, onLogout }) {
  const clock = useClock();
  const isAdmin = role === ROLE.ADMIN;

  // Sidebar "assim" (referência que você mandou) – e por role:
  const linksAdmin = [
    { to: "/dashboard", label: "Dashboard", icon: "🏠" },
    { to: "/pagamentos", label: "Pagamentos", icon: "💳" },
    { to: "/repasses", label: "Repasses", icon: "🔁" },
    { to: "/advogados", label: "Advogados", icon: "👩‍⚖️" },
    { to: "/clientes", label: "Clientes", icon: "👥" },
    { to: "/historico", label: "Histórico", icon: "🗂️" },
    { to: "/relatorios", label: "Relatórios", icon: "📄" },
    { to: "/configuracoes", label: "Configurações", icon: "⚙️" },
  ];

  const linksUser = [
    { to: "/dashboard", label: "Dashboard", icon: "🏠" },
    { to: "/repasses", label: "Repasses", icon: "🔁" },
    { to: "/historico", label: "Histórico", icon: "🗂️" },
    { to: "/relatorios", label: "Relatórios", icon: "📄" },
  ];

  const links = isAdmin ? linksAdmin : linksUser;

  return (
    <aside className="w-[280px] shrink-0 h-screen sticky top-0 bg-slate-950 text-slate-100 border-r border-white/10 flex flex-col">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
            {logoSrc ? (
              <img src={logoSrc} alt="AMR" className="h-10 w-auto object-contain" />
            ) : (
              <span className="text-sm font-semibold">AMR</span>
            )}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">AMR Advogados</div>
            <div className="text-xs text-slate-300">Controles</div>
          </div>
        </div>
      </div>

      <nav className="px-3 py-2 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-slate-400 px-3 mb-2">
          {isAdmin ? "Operacional / Administrativo" : "Operacional"}
        </div>

        <div className="space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition",
                  isActive ? "bg-white/10 text-white" : "text-slate-200 hover:bg-white/5",
                ].join(" ")
              }
            >
              <span className="w-5 text-center">{l.icon}</span>
              <span className="truncate">{l.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Descanso – TEMP */}
        <DescansoWidget />
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <div className="text-xs text-slate-300">
          <div className="flex items-center justify-between">
            <span>{clock.date}</span>
            <span className="tabular-nums">{clock.time}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-slate-400">Usuário</span>
            <span className="font-medium text-slate-100">Em desenvolvimento</span>
          </div>
        </div>

        <button
          className="mt-3 w-full rounded-xl bg-red-600/20 text-red-100 border border-red-500/30 py-2 text-sm hover:bg-red-600/25"
          onClick={onLogout}
        >
          Sair
        </button>
      </div>
    </aside>
  );
}

function Shell({ title, children }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="px-8 pt-7 pb-3">
        <div className="text-xl font-semibold text-slate-900">{title}</div>
      </div>
      <div className="px-8 pb-10">{children}</div>
    </div>
  );
}

// ===== Pages (placeholders) =====
function Dashboard() {
  return (
    <Shell title="Dashboard">
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-5">
        <div className="text-sm text-slate-700">
          Em desenvolvimento. (Admin vê tudo / User verá apenas seus dados.)
        </div>
      </div>
    </Shell>
  );
}
function Pagamentos() {
  return (
    <Shell title="Pagamentos">
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 text-sm text-slate-700">
        Em desenvolvimento.
      </div>
    </Shell>
  );
}
function Repasses() {
  return (
    <Shell title="Repasses">
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 text-sm text-slate-700">
        Em desenvolvimento.
      </div>
    </Shell>
  );
}
function Advogados() {
  return (
    <Shell title="Advogados">
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 text-sm text-slate-700">
        Em desenvolvimento.
      </div>
    </Shell>
  );
}
function Clientes() {
  return (
    <Shell title="Clientes">
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 text-sm text-slate-700">
        Em desenvolvimento.
      </div>
    </Shell>
  );
}
function Historico() {
  return (
    <Shell title="Histórico">
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 text-sm text-slate-700">
        Em desenvolvimento.
      </div>
    </Shell>
  );
}
function Relatorios() {
  return (
    <Shell title="Relatórios">
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 text-sm text-slate-700">
        Em desenvolvimento.
      </div>
    </Shell>
  );
}
function Configuracoes() {
  return (
    <Shell title="Configurações">
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 text-sm text-slate-700">
        Em desenvolvimento.
      </div>
    </Shell>
  );
}

// ===== Login (ajuste principal aqui) =====
function safeErrorMessage(e) {
  // normaliza qualquer erro pra string amigável (mata o [object Object])
  if (!e) return "Erro no login.";
  if (typeof e === "string") return e;

  if (typeof e === "object") {
    const msg =
      e.message ||
      e.error ||
      e.detail ||
      (e.response && (e.response.message || e.response.error)) ||
      null;

    if (msg && typeof msg === "string") return msg;

    try {
      return JSON.stringify(e);
    } catch {
      return "Erro no login.";
    }
  }
  return String(e);
}

function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const from = loc.state?.from || "/dashboard";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const resp = await api.post("/api/auth/login", { email, senha });

      // esperado: { token, role, user? }
      const token = resp?.token;
      const role = resp?.role || resp?.user?.role;
      const user = resp?.user?.nome || resp?.user?.email || email;

      if (!token || !role) throw new Error("Resposta de login inválida.");
      writeAuth({ token, role, user });

      nav(from, { replace: true });
    } catch (e2) {
      setErr(safeErrorMessage(e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header topo com logo + AMR Advogados centralizados */}
      <div className="px-6 pt-10">
        <div className="mx-auto max-w-5xl flex flex-col items-center">
          <div className="flex items-center justify-center">
            {logoSrc ? (
              <img src={logoSrc} alt="AMR Advogados" className="h-10 w-auto object-contain" />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold">
                AMR
              </div>
            )}
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-900">AMR Advogados</div>
        </div>
      </div>

      {/* Card login */}
      <div className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm p-6">
          <div className="text-lg font-semibold text-slate-900">Login</div>
          <div className="mt-1 text-sm text-slate-600">
            Entre com seu usuário e senha para acessar o sistema.
          </div>

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-xs font-medium text-slate-600">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="seuemail@amradvogados.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-900/10"
                placeholder="••••••••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {err && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 text-white py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="mt-6 text-xs text-slate-500">
            Token via Authorization: Bearer (temporário).
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== App Root =====
function AuthedApp() {
  const [auth, setAuth] = useState(() => readAuth());
  const location = useLocation();
  const nav = useNavigate();

  function logout() {
    clearAuth();
    setAuth(readAuth());
    nav("/login", { replace: true });
  }

  // Atualiza auth se mudar no localStorage (ex.: logout automático)
  useEffect(() => {
    const onStorage = () => setAuth(readAuth());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Título do módulo no header (topo do conteúdo)
  const moduleTitle = useMemo(() => {
    const p = location.pathname;
    if (p.startsWith("/dashboard")) return "Dashboard";
    if (p.startsWith("/pagamentos")) return "Pagamentos";
    if (p.startsWith("/repasses")) return "Repasses";
    if (p.startsWith("/advogados")) return "Advogados";
    if (p.startsWith("/clientes")) return "Clientes";
    if (p.startsWith("/historico")) return "Histórico";
    if (p.startsWith("/relatorios")) return "Relatórios";
    if (p.startsWith("/configuracoes")) return "Configurações";
    return "AMR Advogados";
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <Sidebar current={location.pathname} role={auth.role} onLogout={logout} />
      <div className="flex-1 min-w-0">
        <div className="h-14 px-8 flex items-center justify-between border-b border-slate-200 bg-white/70 backdrop-blur">
          <div className="text-sm font-semibold text-slate-900">{moduleTitle}</div>
          <div className="text-xs text-slate-500">Backend: ok</div>
        </div>

        <Routes>
          {/* Base */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Rotas compartilhadas */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/repasses"
            element={
              <ProtectedRoute>
                <Repasses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/historico"
            element={
              <ProtectedRoute>
                <Historico />
              </ProtectedRoute>
            }
          />
          <Route
            path="/relatorios"
            element={
              <ProtectedRoute>
                <Relatorios />
              </ProtectedRoute>
            }
          />

          {/* Admin-only */}
          <Route
            path="/pagamentos"
            element={
              <RoleRoute allowedRoles={[ROLE.ADMIN]}>
                <Pagamentos />
              </RoleRoute>
            }
          />
          <Route
            path="/advogados"
            element={
              <RoleRoute allowedRoles={[ROLE.ADMIN]}>
                <Advogados />
              </RoleRoute>
            }
          />
          <Route
            path="/clientes"
            element={
              <RoleRoute allowedRoles={[ROLE.ADMIN]}>
                <Clientes />
              </RoleRoute>
            }
          />
          <Route
            path="/configuracoes"
            element={
              <RoleRoute allowedRoles={[ROLE.ADMIN]}>
                <Configuracoes />
              </RoleRoute>
            }
          />

          <Route path="/nao-autorizado" element={<AcessoNaoAutorizado />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  const auth = readAuth();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* se já logado, não deixa ficar no login */}
        <Route
          path="/"
          element={auth.token ? <AuthedApp /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/*"
          element={auth.token ? <AuthedApp /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
