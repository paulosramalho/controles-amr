import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import logoSrc from "./assets/logo.png";
import { apiFetch, setAuth, getUser, getToken, clearAuth } from "./lib/api";

import AdvogadosPage from "./pages/Advogados";
import UsuariosPage from "./pages/Usuarios";
import ClientesPage from "./pages/Clientes";
import PagamentosPage from "./pages/Pagamentos";
import ContratoPage from "./pages/Contrato";


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
  };Routes
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
      aria-label="Carregando"
      role="status"
    />
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    try {
      const resp = await apiFetch("/auth/login", {
        method: "POST",
        body: { email, senha },
      });
      // salva token e user
      setAuth(resp.token, resp.user);
      onLogin(resp.user);
    } catch (err) {
      setError(err?.message || "Erro no login");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col items-center text-center">
          <img src={logoSrc} alt="AMR" className="h-10 w-auto" />
          <div className="mt-5 text-[15px] font-semibold text-slate-800 tracking-wide whitespace-nowrap">
            Controle de recebimentos, repasses e obrigações internas
          </div>
        </div>

        <h1 className="mt-6 text-lg font-semibold text-slate-900">Login</h1>
        <p className="text-sm text-slate-600 mt-1">
          Entre com seu usuário e senha para acessar o sistema.
        </p>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">E-mail</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Senha</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              type="password"
              autoComplete="current-password"
              disabled={isSubmitting}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-slate-900 text-white py-2.5 text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Spinner />
                <span>Entrando...</span>
              </span>
            ) : (
              "Entrar"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function Placeholder({ title }) {
  return (
    <div className="p-6">
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <div className="mt-2 text-sm text-slate-600">Em desenvolvimento.</div>
    </div>
  );
}

function Chevron({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 transition-transform ${open ? "rotate-90" : "rotate-0"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function AppShell({ user, onLogout }) {
  const clock = useClock();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";
  const [openSettings, setOpenSettings] = useState(false);
  const [openLivroCaixa, setOpenLivroCaixa] = useState(false);
  const [openLancamentos, setOpenLancamentos] = useState(false);

  const menu = useMemo(() => {
    if (isAdmin) {
      return [
        { to: "/dashboard", label: "Dashboard" },
        { to: "/repasses", label: "Repasses" },

        // ✅ Livro Caixa (abaixo de Repasses)
        {
          type: "group",
          label: "Livro Caixa",
          children: [
            {
              type: "subgroup",
              label: "Lançamentos",
              children: [
                { to: "/livro-caixa/realizar", label: "Realizar" },
                { to: "/livro-caixa/agendar", label: "Agendar" },
              ],
            },
            { to: "/livro-caixa/visualizacao", label: "Visualização" },
            { to: "/livro-caixa/emissao", label: "Emissão" },
          ],
        },

        // ✅ Pagamentos sai de Configurações e fica abaixo de Livro Caixa
        { to: "/pagamentos", label: "Pagamentos" },

        { to: "/historico", label: "Histórico" },
        { to: "/relatorios", label: "Relatórios" },

        // ✅ Configurações como ÚLTIMO item (abaixo de Relatórios)
        {
          type: "group",
          label: "Configurações",
          children: [
            { to: "/advogados", label: "Advogados" },
            { to: "/clientes", label: "Clientes" },
            { to: "/usuarios", label: "Usuários" },
          ],
        },
      ];
    }

    // USER
    return [{ to: "/advogados", label: "Meu Perfil Profissional" }];
  }, [isAdmin]);

  // ✅ default route inteligente
  useEffect(() => {
    if (location.pathname === "/") {
      navigate(isAdmin ? "/dashboard" : "/advogados", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Classe ativa (azul mais escuro)
  const navClass = ({ isActive }) =>
    `block rounded-lg px-4 py-2 text-sm transition-colors
     ${
       isActive
         ? "bg-blue-200 text-blue-950 font-semibold ring-1 ring-blue-200"
         : "text-slate-700 hover:bg-blue-50 hover:text-slate-900 hover:ring-1 hover:ring-blue-100"
     }`;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ✅ Sidebar fixa */}
      <aside className="fixed left-0 top-0 w-64 h-screen bg-slate-50 border-r border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-200">
          <div className="flex flex-col items-center justify-center">
            <img src={logoSrc} alt="AMR" className="h-7 w-auto" />
            <div className="mt-3 text-center">
              <div className="text-xs text-slate-500 leading-tight tracking-wide">
                Controle de recebimentos, repasses e obrigações internas
              </div>
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-2 flex-1 overflow-auto">
          {menu.map((item) => {
            if (item.type === "group") {
              const opened = item.label === "Configurações" ? openSettings : openLivroCaixa;
              const toggle =
                item.label === "Configurações" ? setOpenSettings : setOpenLivroCaixa;

              return (
                <div key={item.label} className="mt-2">
                  <button
                    type="button"
                    onClick={() => toggle((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                    aria-expanded={opened}
                  >
                    <span>{item.label}</span>
                    <span className="text-slate-500">
                      <Chevron open={opened} />
                    </span>
                  </button>

                  {opened ? (
                    <div className="space-y-1 mt-1">
                      {item.children.map((child) => {
                        if (child.type === "subgroup") {
                          const openedSub = openLancamentos;
                          return (
                            <div key={child.label}>
                              <button
                                type="button"
                                onClick={() => setOpenLancamentos((v) => !v)}
                                className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                                aria-expanded={openedSub}
                                style={{ paddingLeft: 28 }}
                              >
                                <span>{child.label}</span>
                                <span className="text-slate-500">
                                  <Chevron open={openedSub} />
                                </span>
                              </button>

                              {openedSub ? (
                                <div className="space-y-1 mt-1">
                                  {child.children.map((gchild) => (
                                    <NavLink
                                      key={gchild.to}
                                      to={gchild.to}
                                      className={navClass}
                                      style={{ paddingLeft: 44 }}
                                    >
                                      {gchild.label}
                                    </NavLink>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        }

                        return (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            className={navClass}
                            style={{ paddingLeft: 28 }}
                          >
                            {child.label}
                          </NavLink>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <NavLink key={item.to} to={item.to} className={navClass}>
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
            <span>{clock.date}</span>
            <span>{clock.time}</span>
          </div>

          <div className="mt-1 flex items-center justify-between text-sm text-slate-600">
            <span className="truncate max-w-[160px]">{user?.nome || "—"}</span>
            <span className="font-semibold text-slate-700">{user?.role || "—"}</span>
          </div>

          <button
            onClick={onLogout}
            className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* ✅ Conteúdo com scroll independente */}
      <main className="ml-64 h-screen overflow-y-auto">
        <Routes>
          <Route path="/dashboard" element={<Placeholder title="Dashboard" />} />
          <Route path="/pagamentos" element={<PagamentosPage user={user} />} />
          <Route path="/contratos/:id" element={<ContratoPage user={user} />} />
          <Route path="/repasses" element={<Placeholder title="Repasses" />} />
          <Route path="/livro-caixa/realizar" element={<Placeholder title="Livro Caixa — Realizar" />} />
          <Route path="/livro-caixa/agendar" element={<Placeholder title="Livro Caixa — Agendar" />} />
          <Route path="/livro-caixa/visualizacao" element={<Placeholder title="Livro Caixa — Visualização" />} />
          <Route path="/livro-caixa/emissao" element={<Placeholder title="Livro Caixa — Emissão" />} />
          <Route path="/advogados" element={<AdvogadosPage user={user} />} />
          <Route path="/clientes" element={<ClientesPage user={user} />} />
          <Route path="/usuarios" element={<UsuariosPage user={user} />} />
          <Route path="/historico" element={<Placeholder title="Histórico" />} />
          <Route path="/relatorios" element={<Placeholder title="Relatórios" />} />
          <Route path="/configuracoes" element={<Placeholder title="Configurações" />} />
          <Route path="*" element={<Placeholder title="Página não encontrada" />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);

  function handleLogin(u) {
    setUser(u);
  }

  function handleLogout() {
    setUser(null);
    clearAuth?.();
    localStorage.removeItem("token");
    localStorage.removeItem("auth");
  }

  // ✅ restaura sessão se já tiver token + user
  useEffect(() => {
    const token = getToken?.();
    const storedUser = getUser?.();
    if (token && storedUser && !user) setUser(storedUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return <Login onLogin={handleLogin} />;
  return <AppShell user={user} onLogout={handleLogout} />;
}
