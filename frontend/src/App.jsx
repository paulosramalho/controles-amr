// frontend/src/App.jsx
import { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { apiFetch, logoutLocal } from "./lib/api";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";

// Logo (você colocou em /src/assets/logo.png)
let logoSrc = null;
try {
  logoSrc = new URL("./assets/logo.png", import.meta.url).href;
} catch {
  logoSrc = null;
}

const AUTH_KEY = "amr_auth";

const VIEWS = {
  LOGIN: "/login",
  DASH: "/dashboard",
  PAGAMENTOS: "/pagamentos",
  REPASSES: "/repasses",
  ADVOGADOS: "/advogados",
  CLIENTES: "/clientes",
  HISTORICO: "/historico",
  RELATORIOS: "/relatorios",
  CONFIG: "/configuracoes",
};

function pad(n) {
  return String(n).padStart(2, "0");
}
function fmtDate(d) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function fmtTime(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// decode JWT sem libs (só pra pegar role/sub com segurança de UI)
function decodeJwtPayload(token) {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base)
        .split("")
        .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
}
function writeAuth(next) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(next));
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** =========================
 *  Descanso (TEMPORÁRIO)
 *  Tudo aqui é temporário e será removido ao final.
 *  ========================= */
function useDescanso() {
  const now = useClock();
  const [hora, setHora] = useState("22:00");
  const [modalOpen, setModalOpen] = useState(false);
  const [postergarOpen, setPostergarOpen] = useState(false);
  const [novaHora, setNovaHora] = useState("22:30");

  const target = useMemo(() => {
    const [hh, mm] = hora.split(":").map((x) => parseInt(x || "0", 10));
    const d = new Date(now);
    d.setHours(hh || 0, mm || 0, 0, 0);
    return d;
  }, [hora, now]);

  const diffMs = target.getTime() - now.getTime();
  const remaining = Math.max(0, diffMs);

  const left = useMemo(() => {
    const total = Math.floor(remaining / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }, [remaining]);

  useEffect(() => {
    if (remaining === 0) {
      setModalOpen(true);
    }
  }, [remaining]);

  function periodoSaudacao() {
    const h = now.getHours();
    if (h >= 5 && h < 12) return { text: "Bom dia", icon: "☀️" };
    if (h >= 12 && h < 18) return { text: "Boa tarde", icon: "🌤️" };
    if (h >= 18 && h < 24) return { text: "Boa noite", icon: "🌙" };
    return { text: "Boa noite", icon: "🌙" };
  }

  const saud = periodoSaudacao();

  return {
    now,
    hora,
    setHora,
    left,
    modalOpen,
    setModalOpen,
    postergarOpen,
    setPostergarOpen,
    novaHora,
    setNovaHora,
    saud,
  };
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Placeholder({ title, subtitle }) {
  return (
    <div className="max-w-4xl">
      <Card title={title}>
        <p className="text-sm text-slate-600">{subtitle}</p>
        <p className="mt-3 text-sm text-slate-600">
          Módulo preparado na navegação. Agora a gente constrói com dados e permissões reais.
        </p>
      </Card>
    </div>
  );
}

export default function App() {
  const nav = useNavigate();
  const loc = useLocation();
  const now = useClock();

  const [auth, setAuth] = useState(() => {
    const a = readAuth();
    if (!a?.token) return null;
    const payload = decodeJwtPayload(a.token);
    const roleFromToken = payload?.role || null;
    return {
      token: a.token,
      user: a.user || null,
      role: a.role || roleFromToken || a.user?.role || "USER",
      sub: payload?.sub || a.user?.id || null,
    };
  });

  // Se qualquer request bater 401, api.js dispara "amr:logout"
  useEffect(() => {
    const onLogout = () => {
      setAuth(null);
      if (loc.pathname !== VIEWS.LOGIN) nav(VIEWS.LOGIN, { replace: true });
    };
    window.addEventListener("amr:logout", onLogout);
    return () => window.removeEventListener("amr:logout", onLogout);
  }, [nav, loc.pathname]);

  // Sempre que tiver token, tenta validar via /auth/me (sem depender disso pra UI)
  useEffect(() => {
    let alive = true;
    async function validate() {
      if (!auth?.token) return;
      try {
        const me = await apiFetch("/auth/me");
        if (!alive) return;

        const next = {
          ...auth,
          user: me,
          role: me?.role || auth.role || "USER",
        };
        setAuth(next);
        writeAuth(next);
      } catch {
        // apiFetch já faz logout no 401
      }
    }
    validate();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.token]);

  function doLogout() {
    logoutLocal();
    setAuth(null);
    nav(VIEWS.LOGIN, { replace: true });
  }

  // ===== Role efetivo (corrige Admin aparecendo como USER)
  const role = auth?.role || "USER";

  // ===== Sidebar itens por role
  const menu = useMemo(() => {
    const commonUser = [
      { to: VIEWS.DASH, label: "Dashboard", icon: "▦" },
      { to: VIEWS.REPASSES, label: "Repasses", icon: "⇄" },
      { to: VIEWS.HISTORICO, label: "Histórico", icon: "⏱" },
      { to: VIEWS.RELATORIOS, label: "Relatórios", icon: "📄" },
    ];

    const adminExtra = [
      { to: VIEWS.PAGAMENTOS, label: "Pagamentos", icon: "💳" },
      { to: VIEWS.ADVOGADOS, label: "Advogados", icon: "👤" },
      { to: VIEWS.CLIENTES, label: "Clientes", icon: "🏢" },
      { to: VIEWS.CONFIG, label: "Configurações", icon: "⚙" },
    ];

    if (role === "ADMIN") {
      return {
        operacional: [
          { to: VIEWS.DASH, label: "Dashboard", icon: "▦" },
          { to: VIEWS.PAGAMENTOS, label: "Pagamentos", icon: "💳" },
          { to: VIEWS.REPASSES, label: "Repasses", icon: "⇄" },
          { to: VIEWS.HISTORICO, label: "Histórico", icon: "⏱" },
          { to: VIEWS.RELATORIOS, label: "Relatórios", icon: "📄" },
        ],
        administrativo: [
          { to: VIEWS.ADVOGADOS, label: "Advogados", icon: "👤" },
          { to: VIEWS.CLIENTES, label: "Clientes", icon: "🏢" },
          { to: VIEWS.CONFIG, label: "Configurações", icon: "⚙" },
        ],
      };
    }

    return {
      operacional: commonUser,
      administrativo: [],
    };
  }, [role]);

  // ===== Descanso (preservado)
  const descanso = useDescanso();

  // ===== Login
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loginError, setLoginError] = useState("");

  async function doLogin(e) {
    e?.preventDefault?.();
    setLoginError("");
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, senha }),
      });

      const payload = decodeJwtPayload(data?.token || "");
      const roleFromToken = payload?.role || "USER";

      const next = {
        token: data.token,
        user: data.user || null, // backend pode não devolver user aqui (ok)
        role: roleFromToken,
        sub: payload?.sub || null,
      };

      setAuth(next);
      writeAuth(next);
      nav(VIEWS.DASH, { replace: true });
    } catch (err) {
      setLoginError(String(err?.message || "Erro no login"));
    }
  }

  // ===== Layout base
  if (!auth?.token) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex items-center gap-3">
            {logoSrc ? (
              <img src={logoSrc} alt="AMR" className="h-10 w-auto opacity-90" />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-slate-200" />
            )}
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">AMR Advogados</div>
              <div className="text-xs text-slate-500">Controles</div>
            </div>
          </div>

          <div className="mt-10 flex justify-center">
            <form
              onSubmit={doLogin}
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm p-6"
            >
              <h1 className="text-xl font-semibold text-slate-900">Login</h1>
              <p className="mt-1 text-sm text-slate-600">
                Entre com seu usuário e senha para acessar o sistema.
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700">E-mail</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="username"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    placeholder="seuemail@amradvogados.com"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Senha</label>
                  <input
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    type="password"
                    autoComplete="current-password"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    placeholder="••••••••••••••"
                  />
                </div>

                {loginError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {loginError}
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                >
                  Entrar
                </button>

                <div className="pt-2 text-xs text-slate-500">
                  Token via Authorization: Bearer (temporário).
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        {/* SIDEBAR */}
        <aside className="w-[280px] min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 text-slate-100 border-r border-white/10">
          <div className="px-5 py-5 flex items-center gap-3">
            {logoSrc ? (
              <img src={logoSrc} alt="AMR" className="h-10 w-auto opacity-90" />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-white/10" />
            )}
            <div className="leading-tight">
              <div className="text-sm font-semibold">AMR Advogados</div>
              <div className="text-xs text-slate-300">Controles</div>
            </div>
          </div>

          <nav className="px-3 py-2">
            <div className="px-3 py-2 text-[11px] tracking-widest text-slate-400">
              OPERACIONAL
            </div>
            <div className="space-y-1">
              {menu.operacional.map((i) => (
                <NavItem key={i.to} to={i.to} icon={i.icon} label={i.label} />
              ))}
            </div>

            {role === "ADMIN" && menu.administrativo.length ? (
              <>
                <div className="mt-4 px-3 py-2 text-[11px] tracking-widest text-slate-400">
                  ADMINISTRATIVO
                </div>
                <div className="space-y-1">
                  {menu.administrativo.map((i) => (
                    <NavItem key={i.to} to={i.to} icon={i.icon} label={i.label} />
                  ))}
                </div>
              </>
            ) : null}
          </nav>

          {/* DESCANSO (TEMPORÁRIO / REMOVÍVEL) */}
          <div className="px-4 mt-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-200">Descanso</div>
                <div className="text-xs">{descanso.saud.icon}</div>
              </div>

              <div className="mt-3">
                <label className="text-[11px] text-slate-300">Hora</label>
                <input
                  type="time"
                  value={descanso.hora}
                  onChange={(e) => descanso.setHora(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-[11px] text-slate-300">Faltam</div>
                <div className="text-sm font-semibold">{descanso.left}</div>
              </div>
            </div>
          </div>

          {/* FOOTER INFO */}
          <div className="mt-4 px-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>{fmtDate(now)}</span>
                <span>{fmtTime(now)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-xs text-slate-300">Usuário</div>
                <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-white/10">
                  {role}
                </span>
              </div>

              <button
                onClick={doLogout}
                className="mt-3 w-full rounded-xl bg-rose-500/90 hover:bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Sair
              </button>

              <div className="mt-3 text-[11px] text-slate-400">
                Token via Authorization: Bearer (temporário).
              </div>
            </div>
          </div>

          {/* MODAL DESCANSO */}
          {descanso.modalOpen ? (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6">
              <div className="w-full max-w-md rounded-2xl bg-white shadow-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-900">
                  {descanso.saud.text}! Chegou a hora.
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Você escolheu descansar às <b>{descanso.hora}</b>. Deseja postergar excepcionalmente?
                </p>

                {!descanso.postergarOpen ? (
                  <div className="mt-5 flex gap-3">
                    <button
                      className="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                      onClick={() => descanso.setPostergarOpen(true)}
                    >
                      Sim, postergar
                    </button>
                    <button
                      className="flex-1 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                      onClick={() => {
                        // “Não” => boa noite + botão voltar
                        descanso.setPostergarOpen(false);
                        // mantém modal aberto até clicar “Retornar”
                      }}
                    >
                      Não, vou descansar
                    </button>
                  </div>
                ) : (
                  <div className="mt-5">
                    <label className="text-xs font-semibold text-slate-700">Nova hora</label>
                    <input
                      type="time"
                      value={descanso.novaHora}
                      onChange={(e) => descanso.setNovaHora(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                    <div className="mt-3 flex gap-3">
                      <button
                        className="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                        onClick={() => {
                          descanso.setHora(descanso.novaHora);
                          descanso.setPostergarOpen(false);
                          descanso.setModalOpen(false);
                        }}
                      >
                        Confirmar
                      </button>
                      <button
                        className="flex-1 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                        onClick={() => descanso.setPostergarOpen(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-5 pt-4 border-t border-slate-100">
                  <button
                    className="w-full rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                    onClick={() => {
                      descanso.setPostergarOpen(false);
                      descanso.setModalOpen(false);
                    }}
                  >
                    Retornar
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </aside>

        {/* MAIN */}
        <main className="flex-1 p-8">
          <Routes>
            {/* rotas protegidas (tem token) */}
            <Route
              path={VIEWS.DASH}
              element={
                <ProtectedRoute>
                  <Placeholder title="Dashboard" subtitle="Mostrará apenas seus dados (backend vai filtrar)." />
                </ProtectedRoute>
              }
            />

            <Route
              path={VIEWS.REPASSES}
              element={
                <ProtectedRoute>
                  <Placeholder title="Repasses" subtitle="Apenas seus dados (USER) / todos (ADMIN)." />
                </ProtectedRoute>
              }
            />

            <Route
              path={VIEWS.HISTORICO}
              element={
                <ProtectedRoute>
                  <Placeholder title="Histórico" subtitle="Ainda vamos definir o que entra aqui." />
                </ProtectedRoute>
              }
            />

            <Route
              path={VIEWS.RELATORIOS}
              element={
                <ProtectedRoute>
                  <Placeholder title="Relatórios" subtitle="PDF bonito com cara AMR (USER vê só os seus)." />
                </ProtectedRoute>
              }
            />

            {/* ADMIN ONLY */}
            <Route
              path={VIEWS.PAGAMENTOS}
              element={
                <ProtectedRoute>
                  <RoleRoute allow={["ADMIN"]} role={role}>
                    <Placeholder title="Pagamentos" subtitle="Apenas ADMIN." />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path={VIEWS.ADVOGADOS}
              element={
                <ProtectedRoute>
                  <RoleRoute allow={["ADMIN"]} role={role}>
                    <Placeholder title="Advogados" subtitle="Apenas ADMIN." />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path={VIEWS.CLIENTES}
              element={
                <ProtectedRoute>
                  <RoleRoute allow={["ADMIN"]} role={role}>
                    <Placeholder title="Clientes" subtitle="Apenas ADMIN." />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path={VIEWS.CONFIG}
              element={
                <ProtectedRoute>
                  <RoleRoute allow={["ADMIN"]} role={role}>
                    <Placeholder title="Configurações" subtitle="Gestão de usuários (ativar/desativar/reset senha)." />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            {/* login */}
            <Route path={VIEWS.LOGIN} element={<div />} />

            {/* fallback */}
            <Route path="*" element={<ProtectedRoute>{navTo(VIEWS.DASH)}</ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </div>
  );

  function navTo(to) {
    // pequeno helper render-only (evita componente a mais)
    useEffect(() => {
      nav(to, { replace: true });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  }
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
          isActive ? "bg-white/10 text-white" : "text-slate-200 hover:bg-white/5",
        ].join(" ")
      }
    >
      <span className="w-5 text-center opacity-90">{icon}</span>
      <span className="font-medium">{label}</span>
    </NavLink>
  );
}
