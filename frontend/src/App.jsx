// frontend/src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import RoleRoute from "./components/RoleRoute";
import { api, getAuth, logout, setAuth } from "./lib/api";

import logoSrc from "./assets/logo.png"; // você colocou em /src/assets/logo.png ✅

/**
 * DIRETRIZES DO PROJETO (armário)
 * 1) CPF/CNPJ: máscara + validação em todos os lugares que apareçam/solicitem
 * 2) Datas: DD/MM/AAAA em todos os lugares
 * 3) Horas: HH:MM:SS em todos os lugares
 * 4) Valores R$: máscara moeda digitando 1→0,01 ... exibindo no mesmo padrão, em todos os lugares
 * 5) Layout aprovado é imutável (exceto quando liberado/validado previamente) — liberado aqui só para sidebar nova.
 * 6) Novas diretrizes entram por solicitação do cara.
 * 7) Telefone: máscara (99) 9 9999-9999 em todos os lugares
 */

const MODULES = {
  dashboard: { label: "Dashboard", icon: IconDashboard, path: "/dashboard" },

  // ADMIN
  cadastro: { label: "Cadastro rápido", icon: IconPlus, path: "/cadastro", adminOnly: true },
  listagem: { label: "Listagem", icon: IconList, path: "/listagem", adminOnly: true },
  financeiro: { label: "Dashboard financeiro", icon: IconMoney, path: "/financeiro", adminOnly: true },
  configuracoes: { label: "Configurações", icon: IconGear, path: "/configuracoes", adminOnly: true },

  // Ambos (com restrição no backend depois)
  repasses: { label: "Repasses", icon: IconSwap, path: "/repasses" },
  historico: { label: "Histórico", icon: IconHistory, path: "/historico" },
  relatorios: { label: "Relatórios", icon: IconFile, path: "/relatorios" },
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function fmtDateBR(d) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fmtTimeBR(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function isNight(hour) {
  // lua entre 18:00 e 04:59
  return hour >= 18 || hour < 5;
}

function greetingForHour(hour) {
  // Para descanso: "Boa noite" só se for noite de verdade
  return isNight(hour) ? "Boa noite" : "Bom descanso";
}

/** -------- AUTH GATE -------- */
function Protected({ children }) {
  const { token } = getAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

/** -------- APP -------- */
export default function App() {
  const location = useLocation();
  const nav = useNavigate();

  const [now, setNow] = useState(() => new Date());
  const [backendOk, setBackendOk] = useState(null); // null | true | false

  // descanso
  const [restTime, setRestTime] = useState(""); // "HH:MM"
  const [restActive, setRestActive] = useState(false);
  const [restModalOpen, setRestModalOpen] = useState(false);
  const [postponeMode, setPostponeMode] = useState(false);
  const [postponeTime, setPostponeTime] = useState("");

  // auth
  const auth = getAuth();
  const role = auth.role || "";
  const userName = auth.user?.nome || "Em desenvolvimento";

  const moduleTitle = useMemo(() => {
    const p = location.pathname;
    const found = Object.values(MODULES).find((m) => p === m.path);
    if (found) return found.label;
    if (p.startsWith("/login")) return "Login";
    return "AMR Advogados";
  }, [location.pathname]);

  const visibleMenu = useMemo(() => {
    const all = Object.values(MODULES);

    // USER: só o que você definiu
    if (role === "USER") {
      return [
        MODULES.dashboard,
        MODULES.repasses,
        MODULES.historico,
        MODULES.relatorios,
      ];
    }

    // ADMIN (default): visão total
    return [
      MODULES.dashboard,
      MODULES.cadastro,
      MODULES.listagem,
      MODULES.financeiro,
      MODULES.repasses,
      MODULES.historico,
      MODULES.relatorios,
      MODULES.configuracoes,
    ].filter(Boolean);
  }, [role]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Ping simples do backend (não trava UI)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // tente um endpoint leve do seu backend (ajuste se quiser)
        await fetch((import.meta.env.VITE_API_BASE_URL || "https://controles-amr-backend.onrender.com") + "/health", {
          method: "GET",
        });
        if (alive) setBackendOk(true);
      } catch {
        if (alive) setBackendOk(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Descanso: detectar quando chega a hora
  useEffect(() => {
    if (!restTime) return;
    const [hh, mm] = restTime.split(":").map((x) => parseInt(x, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return;

    const target = new Date(now);
    target.setHours(hh, mm, 0, 0);

    // se horário já passou hoje, mantém para hoje mesmo (efeito do "chegou")
    // e continua disparando só uma vez via restActive
    const reached = now.getTime() >= target.getTime();

    if (reached && !restActive) {
      setRestActive(true);
      setRestModalOpen(true);
      setPostponeMode(false);
      setPostponeTime("");
    }
  }, [now, restTime, restActive]);

  const restCountdown = useMemo(() => {
    if (!restTime) return null;
    const [hh, mm] = restTime.split(":").map((x) => parseInt(x, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

    const target = new Date(now);
    target.setHours(hh, mm, 0, 0);

    let diff = target.getTime() - now.getTime();
    if (diff < 0) diff = 0;

    const totalSec = Math.floor(diff / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  }, [now, restTime]);

  function handleLogout() {
    logout(true);
  }

  function go(path) {
    nav(path, { replace: false });
  }

  return (
    <div className="min-h-screen bg-amr-900 text-white">
      <div className="flex">
        {/* SIDEBAR */}
        <aside className="fixed left-0 top-0 h-screen w-[280px] bg-gradient-to-b from-amr-950 via-amr-900 to-amr-950 border-r border-white/10">
          <div className="h-full flex flex-col">
            {/* Brand */}
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <img
                  src={logoSrc}
                  alt="AMR"
                  className="h-10 w-auto opacity-95"
                />
                <div className="leading-tight">
                  <div className="text-sm font-semibold tracking-wide">AMR Advogados</div>
                  <div className="text-[11px] text-white/60">Controles-AMR</div>
                </div>
              </div>
            </div>

            {/* Menu */}
            <nav className="px-3 mt-2 flex-1">
              <div className="text-[11px] uppercase tracking-wider text-white/40 px-3 mb-2">
                {role === "USER" ? "Operacional" : "Operacional / Administrativo"}
              </div>

              <ul className="space-y-1">
                {visibleMenu.map((m) => (
                  <li key={m.path}>
                    <NavLink
                      to={m.path}
                      className={({ isActive }) =>
                        [
                          "flex items-center gap-3 px-3 py-2 rounded-xl text-sm",
                          "hover:bg-white/5 transition",
                          isActive ? "bg-white/10 border border-white/10" : "border border-transparent",
                        ].join(" ")
                      }
                    >
                      <m.icon className="h-4 w-4 opacity-90" />
                      <span className="truncate">{m.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Footer / User / Clock / Descanso */}
            <div className="px-4 pb-4 pt-3 border-t border-white/10">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/60">Usuário</div>
                  <div className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                    {role || "Em desenvolvimento"}
                  </div>
                </div>
                <div className="mt-1 text-sm font-medium truncate">{userName}</div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-white/70">
                  <div className="flex items-center gap-2">
                    <IconCalendar className="h-4 w-4 opacity-80" />
                    {fmtDateBR(now)}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <IconClock className="h-4 w-4 opacity-80" />
                    {fmtTimeBR(now)}
                  </div>
                </div>

                {/* Descanso (temporário e removível) */}
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-white/60">Descanso</div>
                    <div className="flex items-center gap-1 text-white/70">
                      {isNight(now.getHours()) ? (
                        <IconMoon className="h-4 w-4" />
                      ) : (
                        <IconSun className="h-4 w-4" />
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="time"
                      value={restTime}
                      onChange={(e) => {
                        setRestTime(e.target.value);
                        setRestActive(false);
                        setRestModalOpen(false);
                        setPostponeMode(false);
                        setPostponeTime("");
                      }}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>

                  {restTime ? (
                    <div className="mt-2 text-[12px] text-white/70">
                      <div>Hora escolhida: <span className="text-white">{restTime}</span></div>
                      <div>Contagem regressiva: <span className="text-white">{restCountdown ?? "--:--:--"}</span></div>
                    </div>
                  ) : (
                    <div className="mt-2 text-[12px] text-white/50">
                      Defina uma hora para descansar.
                    </div>
                  )}
                </div>

                <button
                  onClick={handleLogout}
                  className="mt-3 w-full rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-400/20 text-red-100 py-2 text-sm"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="ml-[280px] min-h-screen w-full">
          {/* Header */}
          <header className="sticky top-0 z-10 bg-amr-900/70 backdrop-blur border-b border-white/10">
            <div className="px-6 py-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">{moduleTitle}</div>
                <div className="text-xs text-white/60">
                  Backend:{" "}
                  {backendOk === null ? "verificando..." : backendOk ? "ok" : "erro"}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => go("/dashboard")}
                  className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-sm"
                >
                  Início
                </button>
              </div>
            </div>
          </header>

          <div className="p-6">
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                path="/dashboard"
                element={
                  <Protected>
                    <DashboardPage />
                  </Protected>
                }
              />

              {/* ADMIN ONLY */}
              <Route
                path="/cadastro"
                element={
                  <Protected>
                    <RoleRoute allowed={["ADMIN"]}>
                      <CadastroRapidoPage />
                    </RoleRoute>
                  </Protected>
                }
              />
              <Route
                path="/listagem"
                element={
                  <Protected>
                    <RoleRoute allowed={["ADMIN"]}>
                      <ListagemPage />
                    </RoleRoute>
                  </Protected>
                }
              />
              <Route
                path="/financeiro"
                element={
                  <Protected>
                    <RoleRoute allowed={["ADMIN"]}>
                      <FinanceiroPage />
                    </RoleRoute>
                  </Protected>
                }
              />
              <Route
                path="/configuracoes"
                element={
                  <Protected>
                    <RoleRoute allowed={["ADMIN"]}>
                      <ConfiguracoesPage />
                    </RoleRoute>
                  </Protected>
                }
              />

              {/* BOTH (backend vai restringir por usuário depois) */}
              <Route
                path="/repasses"
                element={
                  <Protected>
                    <RepassesPage />
                  </Protected>
                }
              />
              <Route
                path="/historico"
                element={
                  <Protected>
                    <HistoricoPage />
                  </Protected>
                }
              />
              <Route
                path="/relatorios"
                element={
                  <Protected>
                    <RelatoriosPage />
                  </Protected>
                }
              />

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </main>

        {/* MODAL DESCANSO */}
        {restModalOpen && (
          <RestModal
            now={now}
            onClose={() => {
              setRestModalOpen(false);
              setPostponeMode(false);
              setPostponeTime("");
            }}
            onPostpone={() => {
              setPostponeMode(true);
              setPostponeTime(restTime || "");
            }}
            postponeMode={postponeMode}
            postponeTime={postponeTime}
            setPostponeTime={setPostponeTime}
            onConfirmPostpone={() => {
              if (!postponeTime) return;
              setRestTime(postponeTime);
              setRestActive(false);
              setRestModalOpen(false);
              setPostponeMode(false);
              setPostponeTime("");
            }}
          />
        )}
      </div>
    </div>
  );
}

/** -------- PAGES (placeholders bonitos; evoluímos depois) -------- */

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl">
      <div className="text-base font-semibold">{title}</div>
      <div className="mt-3 text-sm text-white/70">{children}</div>
    </div>
  );
}

function DashboardPage() {
  const { role } = getAuth();
  return (
    <div className="grid gap-4">
      <Card title="Resumo">
        {role === "USER"
          ? "Você está na visão USER. Aqui vai entrar somente o que for seu."
          : "Você está na visão ADMIN. Aqui entra visão total e irrestrita."}
      </Card>
    </div>
  );
}

function CadastroRapidoPage() {
  return (
    <div className="grid gap-4">
      <Card title="Cadastro rápido (Cliente + Ordem)">
        Mantemos a tela atual e evoluímos por módulo. (Admin)
      </Card>
    </div>
  );
}

function ListagemPage() {
  return (
    <div className="grid gap-4">
      <Card title="Listagem (Clientes & Ordens)">Admin: filtros, paginação, etc.</Card>
    </div>
  );
}

function FinanceiroPage() {
  return (
    <div className="grid gap-4">
      <Card title="Dashboard financeiro">Admin: visão geral e filtros.</Card>
    </div>
  );
}

function RepassesPage() {
  return (
    <div className="grid gap-4">
      <Card title="Repasses">Admin vê tudo; User verá apenas o próprio (backend vai garantir).</Card>
    </div>
  );
}

function HistoricoPage() {
  return (
    <div className="grid gap-4">
      <Card title="Histórico">Ainda não definido (mantido quieto como você pediu).</Card>
    </div>
  );
}

function RelatoriosPage() {
  return (
    <div className="grid gap-4">
      <Card title="Relatórios">User first: apenas seus dados; PDF com cara AMR depois.</Card>
    </div>
  );
}

function ConfiguracoesPage() {
  return (
    <div className="grid gap-4">
      <Card title="Configurações (Admin)">Gestão de usuários, modelos, etc.</Card>
    </div>
  );
}

/** -------- LOGIN -------- */

function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const { token } = getAuth();
    if (token) nav("/dashboard", { replace: true });
  }, [nav]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const resp = await api.post("/api/auth/login", { email, senha });
      // Esperado: { token, user: { id, nome, email, role } }
      setAuth({
        token: resp.token,
        role: resp.user?.role,
        user: resp.user,
      });
      nav("/dashboard", { replace: true });
    } catch (ex) {
      setErr(ex?.message || "Erro no login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
        <div className="text-xl font-semibold">Login</div>
        <div className="text-sm text-white/60 mt-1">
          Entre com seu usuário e senha para acessar o sistema.
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <div>
            <label className="text-xs text-white/60">E-mail</label>
            <input
              className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="seuemail@amradvogados.com"
            />
          </div>

          <div>
            <label className="text-xs text-white/60">Senha</label>
            <input
              className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••••••••"
            />
          </div>

          {err ? (
            <div className="text-sm text-red-200 bg-red-500/10 border border-red-400/20 rounded-xl p-3">
              {err}
            </div>
          ) : null}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 py-2 text-sm disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

/** -------- REST MODAL -------- */

function RestModal({
  now,
  onClose,
  onPostpone,
  postponeMode,
  postponeTime,
  setPostponeTime,
  onConfirmPostpone,
}) {
  const msg = greetingForHour(now.getHours());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-amr-900 p-6 shadow-2xl">
        <div className="flex items-center gap-2">
          {isNight(now.getHours()) ? <IconMoon className="h-5 w-5" /> : <IconSun className="h-5 w-5" />}
          <div className="text-lg font-semibold">Hora chegou</div>
        </div>

        <p className="mt-2 text-sm text-white/70">
          Chegou a hora escolhida. Você deve ir descansar agora.
        </p>

        {!postponeMode ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={onPostpone}
                className="rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 py-2 text-sm"
              >
                Postergar
              </button>
              <button
                onClick={() => {
                  // “não, vou descansar”
                  // Mantém mensagem adequada ao horário
                  alert(`${msg}!`);
                }}
                className="rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-400/20 py-2 text-sm text-emerald-100"
              >
                Vou descansar
              </button>
            </div>

            <button
              onClick={onClose}
              className="mt-3 w-full rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-2 text-sm"
            >
              Retornar
            </button>
          </>
        ) : (
          <>
            <div className="mt-4">
              <label className="text-xs text-white/60">Nova hora</label>
              <input
                type="time"
                value={postponeTime}
                onChange={(e) => setPostponeTime(e.target.value)}
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={onConfirmPostpone}
                className="rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 py-2 text-sm"
              >
                Confirmar
              </button>
              <button
                onClick={onClose}
                className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** -------- ICONS (minimalistas) -------- */
function IconBase({ children, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}
function IconDashboard(props) {
  return (
    <IconBase {...props}>
      <path d="M4 13h7V4H4v9Zm9 7h7V11h-7v9ZM4 20h7v-5H4v5Zm9-9h7V4h-7v7Z" fill="currentColor" opacity="0.9" />
    </IconBase>
  );
}
function IconPlus(props) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </IconBase>
  );
}
function IconList(props) {
  return (
    <IconBase {...props}>
      <path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </IconBase>
  );
}
function IconMoney(props) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16v10H4V7Z" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </IconBase>
  );
}
function IconSwap(props) {
  return (
    <IconBase {...props}>
      <path d="M7 7h10l-2-2M17 17H7l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </IconBase>
  );
}
function IconHistory(props) {
  return (
    <IconBase {...props}>
      <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 12a8 8 0 1 0 2.3-5.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 4v4h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </IconBase>
  );
}
function IconFile(props) {
  return (
    <IconBase {...props}>
      <path d="M7 3h7l3 3v15H7V3Z" stroke="currentColor" strokeWidth="2" />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth="2" />
    </IconBase>
  );
}
function IconGear(props) {
  return (
    <IconBase {...props}>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M19 12a7.2 7.2 0 0 0-.1-1l2-1.5-2-3.5-2.3.8a7.8 7.8 0 0 0-1.7-1L14.5 3h-5L9 5.8a7.8 7.8 0 0 0-1.7 1L5 6l-2 3.5 2 1.5a7.2 7.2 0 0 0 0 2L3 14.5 5 18l2.3-.8a7.8 7.8 0 0 0 1.7 1L9.5 21h5l.5-2.8a7.8 7.8 0 0 0 1.7-1L19 18l2-3.5-2-1.5c.1-.3.1-.7.1-1Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}
function IconCalendar(props) {
  return (
    <IconBase {...props}>
      <path d="M7 3v3M17 3v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 8h16v13H4V8Z" stroke="currentColor" strokeWidth="2" />
    </IconBase>
  );
}
function IconClock(props) {
  return (
    <IconBase {...props}>
      <path d="M12 7v6l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" stroke="currentColor" strokeWidth="2" />
    </IconBase>
  );
}
function IconMoon(props) {
  return (
    <IconBase {...props}>
      <path
        d="M21 14.5A7.5 7.5 0 0 1 9.5 3a6.5 6.5 0 1 0 11.5 11.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </IconBase>
  );
}
function IconSun(props) {
  return (
    <IconBase {...props}>
      <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" strokeWidth="2" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </IconBase>
  );
}
