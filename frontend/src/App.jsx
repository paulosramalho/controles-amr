// frontend/src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { apiFetch, setAuth, clearAuth, getToken } from "./lib/api";

import logoSrc from "./assets/logo.png"; // /src/assets/logo.png

/**
 * DIRETRIZES DO PROJETO (armário)
 * 1) CPF/CNPJ: máscara + validação em todos os lugares que apareçam/solicitem
 * 2) Datas: DD/MM/AAAA em todos os lugares
 * 3) Horas: HH:MM:SS em todos os lugares
 * 4) Valores R$: máscara moeda digitando 1→0,01 ... exibindo no mesmo padrão, em todos os lugares
 * 5) Layout aprovado é imutável (exceto quando liberado/validado previamente) — liberado aqui para sidebar nova.
 * 6) Novas diretrizes entram por solicitação do cara.
 * 7) Telefone: máscara (99) 9 9999-9999 em todos os lugares
 */

/* ------------------ utils de data/hora ------------------ */
const pad2 = (n) => String(n).padStart(2, "0");
function fmtDateBR(d) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function fmtTimeBR(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
function isNight(hour) {
  return hour >= 18 || hour < 5;
}
function greetingForHour(hour) {
  return isNight(hour) ? "Boa noite" : "Bom descanso";
}

/* ------------------ auth storage helpers ------------------ */
function readAuth() {
  try {
    const raw = localStorage.getItem("amr_auth");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* ------------------ components: gates ------------------ */
function Protected({ token, children }) {
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function AccessDenied({ seconds = 5, to = "/dashboard" }) {
  const nav = useNavigate();
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    setLeft(seconds);
    const t = setInterval(() => setLeft((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  useEffect(() => {
    if (left <= 0) nav(to, { replace: true });
  }, [left, nav, to]);

  return (
    <div className="p-6">
      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-slate-500">Acesso não autorizado</div>
        <div className="mt-1 text-lg font-semibold text-slate-900">
          Você não tem permissão para acessar esta área.
        </div>
        <div className="mt-2 text-sm text-slate-600">
          Redirecionando para o Dashboard em <span className="font-semibold">{Math.max(left, 0)}s</span>…
        </div>

        <button
          onClick={() => nav(to, { replace: true })}
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-amr-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Voltar agora
        </button>
      </div>
    </div>
  );
}

function RequireRole({ role, allow = [], children }) {
  if (!allow.includes(role)) return <AccessDenied />;
  return children;
}

/* ------------------ icons (minimalistas) ------------------ */
function Icon({ children }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center text-slate-200/90">
      {children}
    </span>
  );
}
function IconDashboard() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M4 13.5V20a1 1 0 0 0 1 1h5v-7.5H5a1 1 0 0 0-1 1Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M14 3h5a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1h-5V3Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M4 4a1 1 0 0 1 1-1h5v7.5H5a1 1 0 0 1-1-1V4Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M14 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5v-7Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    </Icon>
  );
}
function IconPayments() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v7A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5v-7Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path d="M4 10h16" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7.5 15h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </Icon>
  );
}
function IconRepasses() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M7 7h10M7 17h10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M9 5 7 7l2 2M15 19l2-2-2-2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Icon>
  );
}
function IconUsers() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M4.5 20a7.5 7.5 0 0 1 15 0"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </Icon>
  );
}
function IconClients() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M7 20h10a2 2 0 0 0 2-2V9l-5-5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path d="M14 4v5h5" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </Icon>
  );
}
function IconHistory() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M12 8v5l3 2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3 12a9 9 0 1 0 3-6.7"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M3 4v5h5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Icon>
  );
}
function IconReports() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 13h8M8 17h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </Icon>
  );
}
function IconGear() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M19.4 15a7.8 7.8 0 0 0 .1-6l-2.1-.7a6.7 6.7 0 0 0-1.1-1.9l1-2a7.9 7.9 0 0 0-5.9-1.6L10.6 5a6.8 6.8 0 0 0-2.2.8L6.3 4.5A7.9 7.9 0 0 0 3.6 9l2.1.7a6.7 6.7 0 0 0 0 2.6L3.6 13a7.9 7.9 0 0 0 2.7 4.5l2.1-1.3c.7.4 1.4.7 2.2.8l.8 2.2a7.9 7.9 0 0 0 5.9-1.6l-1-2c.5-.6.9-1.2 1.1-1.9l2-.7Z"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
      </svg>
    </Icon>
  );
}
function IconMoonSun({ hour }) {
  return (
    <Icon>
      {isNight(hour) ? (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
          <path
            d="M21 14.5A7.5 7.5 0 0 1 9.5 3.2 6.5 6.5 0 1 0 21 14.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
          <path
            d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
    </Icon>
  );
}

/* ------------------ pages (placeholders por enquanto) ------------------ */
function PageShell({ title, children }) {
  return (
    <div className="p-6">
      <div className="mb-4">
        <div className="text-sm text-slate-500">{title}</div>
        <div className="text-xl font-semibold text-slate-900">Em desenvolvimento</div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}

function Dashboard() {
  return (
    <PageShell title="Dashboard">
      <div className="text-slate-700">Aqui entra o resumo do mês/competência (Admin vê tudo, User só os próprios dados).</div>
    </PageShell>
  );
}
function Pagamentos() {
  return (
    <PageShell title="Pagamentos">
      <div className="text-slate-700">Cadastro/listagem de pagamentos efetuados por clientes.</div>
    </PageShell>
  );
}
function Repasses() {
  return (
    <PageShell title="Repasses">
      <div className="text-slate-700">Repasses calculados/lançados (User vê apenas os próprios).</div>
    </PageShell>
  );
}
function Advogados() {
  return (
    <PageShell title="Advogados">
      <div className="text-slate-700">Cadastro de advogados (Admin).</div>
    </PageShell>
  );
}
function Clientes() {
  return (
    <PageShell title="Clientes">
      <div className="text-slate-700">Cadastro/listagem de clientes (Admin).</div>
    </PageShell>
  );
}
function Historico() {
  return (
    <PageShell title="Histórico">
      <div className="text-slate-700">Ainda a definir (mantido).</div>
    </PageShell>
  );
}
function Relatorios() {
  return (
    <PageShell title="Relatórios">
      <div className="text-slate-700">Relatórios (User vê apenas os próprios dados; Admin vê tudo).</div>
    </PageShell>
  );
}
function Configuracoes() {
  return (
    <PageShell title="Configurações">
      <div className="text-slate-700">Gestão de usuários, modelos, parâmetros (Admin).</div>
    </PageShell>
  );
}

/* ------------------ login ------------------ */
function Login({ onLogged }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      // ⚠️ IMPORTANTE: apiFetch já prefixa /api, então aqui é SÓ "/auth/login"
      const resp = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, senha }),
      });

      // esperado: { token, user }
      setAuth({ token: resp.token, user: resp.user });
      onLogged?.(resp);
    } catch (e2) {
      setErr(e2?.message || "Erro no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-5xl items-start justify-center px-6 pt-16">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3">
            <img src={logoSrc} alt="AMR Advogados" className="h-9 w-auto" />
            <div className="text-lg font-semibold text-slate-900">AMR Advogados</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xl font-semibold text-slate-900">Login</div>
            <div className="mt-1 text-sm text-slate-600">
              Entre com seu usuário e senha para acessar o sistema.
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600">E-mail</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="username"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amr-navy"
                  placeholder="seuemail@amradvogados.com"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Senha</label>
                <input
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amr-navy"
                  placeholder="••••••••••••••"
                  required
                />
              </div>

              {err ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {err}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-xl bg-amr-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            Token via <span className="font-semibold">Authorization: Bearer</span> (temporário).
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------ main app ------------------ */
export default function App() {
  const location = useLocation();
  const nav = useNavigate();

  const [now, setNow] = useState(() => new Date());

  // auth state
  const [authObj, setAuthObj] = useState(() => readAuth());
  const token = authObj?.token || null;
  const role = authObj?.user?.role || ""; // "ADMIN" | "USER"
  const userName = authObj?.user?.nome || "Em desenvolvimento";

  // descanso
  const [restTime, setRestTime] = useState(""); // "HH:MM"
  const [restActive, setRestActive] = useState(false);
  const [restModalOpen, setRestModalOpen] = useState(false);
  const [postponeMode, setPostponeMode] = useState(false);
  const [postponeTime, setPostponeTime] = useState("");

  // relógio tempo real
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // tenta “hidratar” sessão (se tiver token)
  useEffect(() => {
    const t = getToken();
    if (!t) return;

    // se já tem authObj com user, ok
    if (authObj?.user) return;

    (async () => {
      try {
        const me = await apiFetch("/auth/me", { method: "GET" });
        const current = readAuth();
        setAuth({ token: current?.token || t, user: me.user });
        setAuthObj({ token: current?.token || t, user: me.user });
      } catch {
        clearAuth();
        setAuthObj(null);
        if (!location.pathname.startsWith("/login")) nav("/login", { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moduleTitle = useMemo(() => {
    const p = location.pathname;

    const map = {
      "/dashboard": "Dashboard",
      "/pagamentos": "Pagamentos",
      "/repasses": "Repasses",
      "/advogados": "Advogados",
      "/clientes": "Clientes",
      "/historico": "Histórico",
      "/relatorios": "Relatórios",
      "/configuracoes": "Configurações",
    };

    if (p.startsWith("/login")) return "Login";
    return map[p] || "AMR Advogados";
  }, [location.pathname]);

  const menu = useMemo(() => {
    // USER: só os itens que você definiu
    if (role === "USER") {
      return {
        operacional: [
          { label: "Dashboard", path: "/dashboard", icon: IconDashboard },
          { label: "Repasses", path: "/repasses", icon: IconRepasses },
          { label: "Histórico", path: "/historico", icon: IconHistory },
          { label: "Relatórios", path: "/relatorios", icon: IconReports },
        ],
        administrativo: [],
      };
    }

    // ADMIN: visão total
    return {
      operacional: [
        { label: "Dashboard", path: "/dashboard", icon: IconDashboard },
        { label: "Pagamentos", path: "/pagamentos", icon: IconPayments },
        { label: "Repasses", path: "/repasses", icon: IconRepasses },
        { label: "Histórico", path: "/historico", icon: IconHistory },
        { label: "Relatórios", path: "/relatorios", icon: IconReports },
      ],
      administrativo: [
        { label: "Advogados", path: "/advogados", icon: IconUsers },
        { label: "Clientes", path: "/clientes", icon: IconClients },
        { label: "Configurações", path: "/configuracoes", icon: IconGear },
      ],
    };
  }, [role]);

  /* ------------ descanso: cálculo + disparo modal ------------ */
  const restTarget = useMemo(() => {
    if (!restTime) return null;
    const [hh, mm] = restTime.split(":").map((x) => parseInt(x, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

    const d = new Date(now);
    d.setHours(hh, mm, 0, 0);
    // se horário já passou hoje, entende como “próxima ocorrência” (amanhã)
    if (d.getTime() <= now.getTime()) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }, [restTime, now]);

  const restCountdown = useMemo(() => {
    if (!restTarget) return null;
    const diff = restTarget.getTime() - now.getTime();
    const total = Math.max(0, diff);
    const hh = Math.floor(total / 3600000);
    const mm = Math.floor((total % 3600000) / 60000);
    const ss = Math.floor((total % 60000) / 1000);
    return { diff: total, text: `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}` };
  }, [restTarget, now]);

  useEffect(() => {
    if (!restActive) return;
    if (!restTarget) return;

    // chegou a hora -> abre modal
    if (restCountdown && restCountdown.diff <= 0) {
      setRestModalOpen(true);
      setPostponeMode(false);
      setPostponeTime("");
    }
  }, [restActive, restTarget, restCountdown]);

  function startRest() {
    if (!restTime) return;
    setRestActive(true);
    setRestModalOpen(false);
    setPostponeMode(false);
    setPostponeTime("");
  }

  function stopRest() {
    setRestActive(false);
    setRestModalOpen(false);
    setPostponeMode(false);
    setPostponeTime("");
  }

  function confirmPostpone() {
    if (!postponeTime) return;
    setRestTime(postponeTime);
    setRestActive(true);
    setRestModalOpen(false);
    setPostponeMode(false);
    setPostponeTime("");
  }

  function doLogout() {
    clearAuth();
    setAuthObj(null);
    nav("/login", { replace: true });
  }

  // se logou, direciona
  function onLogged() {
    const next = readAuth();
    setAuthObj(next);
    nav("/dashboard", { replace: true });
  }

  /* ------------------ layout chrome (sidebar + header) ------------------ */
  const showChrome = !location.pathname.startsWith("/login");

  if (!showChrome) {
    return <Login onLogged={onLogged} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className="w-[270px] shrink-0 bg-gradient-to-b from-slate-950 to-amr-navy text-white">
          <div className="flex items-center gap-3 px-5 pt-5">
            <div className="flex items-center gap-3">
              <img src={logoSrc} alt="AMR Advogados" className="h-8 w-auto opacity-95" />
              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-wide">AMR Advogados</div>
                <div className="text-[11px] text-white/60">Controles • Repasses</div>
              </div>
            </div>
          </div>

          <div className="mt-6 px-3">
            <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-white/50">
              Operacional
            </div>
            <nav className="mt-2 space-y-1">
              {menu.operacional.map((item) => {
                const Ico = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      [
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
                        isActive
                          ? "bg-white/10 text-white"
                          : "text-white/80 hover:bg-white/5 hover:text-white",
                      ].join(" ")
                    }
                  >
                    <Ico />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            {menu.administrativo.length > 0 ? (
              <>
                <div className="mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  Administrativo
                </div>
                <nav className="mt-2 space-y-1">
                  {menu.administrativo.map((item) => {
                    const Ico = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                          [
                            "flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
                            isActive
                              ? "bg-white/10 text-white"
                              : "text-white/80 hover:bg-white/5 hover:text-white",
                          ].join(" ")
                        }
                      >
                        <Ico />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </nav>
              </>
            ) : null}
          </div>

          {/* Descanso (TEMPORÁRIO) */}
          <div className="mt-6 px-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-white/80">Descanso (temp)</div>
                <IconMoonSun hour={now.getHours()} />
              </div>

              <label className="mt-3 block text-[11px] font-semibold text-white/60">Hora de descansar</label>
              <input
                type="time"
                value={restTime}
                onChange={(e) => setRestTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-white/25"
              />

              <div className="mt-3 flex gap-2">
                <button
                  onClick={startRest}
                  disabled={!restTime}
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-50"
                >
                  Ativar
                </button>
                <button
                  onClick={stopRest}
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
                >
                  Parar
                </button>
              </div>

              <div className="mt-3 text-[11px] text-white/70">
                <div className="flex items-center justify-between">
                  <span>Escolhida:</span>
                  <span className="font-semibold">{restTime || "--:--"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Contagem:</span>
                  <span className="font-semibold">{restActive && restCountdown ? restCountdown.text : "--:--:--"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer sidebar: data/hora + usuário + sair */}
          <div className="mt-auto px-4 pb-4 pt-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-[11px] text-white/70">
                <span>{fmtDateBR(now)}</span>
                <span>{fmtTimeBR(now)}</span>
              </div>

              <div className="mt-2 text-[11px] text-white/60">Usuário</div>
              <div className="text-sm font-semibold text-white/85">{userName}</div>
              <div className="text-[11px] text-white/50">{role || "Em desenvolvimento"}</div>

              <button
                onClick={doLogout}
                className="mt-3 w-full rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/25"
              >
                Sair
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="min-w-0 flex-1">
          {/* header */}
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <div className="text-xs text-slate-500">Módulo</div>
                <div className="text-lg font-semibold text-slate-900">{moduleTitle}</div>
              </div>

              <div className="text-xs text-slate-500">
                {token ? "Sessão ativa" : "Sessão ausente"}
              </div>
            </div>
          </header>

          {/* routes */}
          <Protected token={token}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/repasses" element={<Repasses />} />
              <Route path="/historico" element={<Historico />} />
              <Route path="/relatorios" element={<Relatorios />} />

              {/* ADMIN only */}
              <Route
                path="/pagamentos"
                element={
                  <RequireRole role={role} allow={["ADMIN"]}>
                    <Pagamentos />
                  </RequireRole>
                }
              />
              <Route
                path="/advogados"
                element={
                  <RequireRole role={role} allow={["ADMIN"]}>
                    <Advogados />
                  </RequireRole>
                }
              />
              <Route
                path="/clientes"
                element={
                  <RequireRole role={role} allow={["ADMIN"]}>
                    <Clientes />
                  </RequireRole>
                }
              />
              <Route
                path="/configuracoes"
                element={
                  <RequireRole role={role} allow={["ADMIN"]}>
                    <Configuracoes />
                  </RequireRole>
                }
              />

              {/* legacy (se vier link antigo) */}
              <Route path="/login" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Protected>
        </main>
      </div>

      {/* MODAL descanso */}
      {restModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="text-sm text-slate-500">Alerta de descanso</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              Chegou a hora escolhida. Você deve ir descansar agora.
            </div>
            <div className="mt-2 text-sm text-slate-600">
              {greetingForHour(now.getHours())} 😄
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  setPostponeMode(true);
                  setPostponeTime("");
                }}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Postergar
              </button>
              <button
                onClick={() => {
                  // não postergar => para o timer, mantém modal até “retornar”
                  setPostponeMode(false);
                  setRestActive(false);
                }}
                className="flex-1 rounded-xl bg-amr-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Não, vou descansar
              </button>
            </div>

            {postponeMode ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-600">Nova hora</div>
                <input
                  type="time"
                  value={postponeTime}
                  onChange={(e) => setPostponeTime(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amr-navy"
                />

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={confirmPostpone}
                    disabled={!postponeTime}
                    className="flex-1 rounded-xl bg-amr-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => {
                      setPostponeMode(false);
                      setPostponeTime("");
                    }}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}

            <button
              onClick={() => setRestModalOpen(false)}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Retornar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
