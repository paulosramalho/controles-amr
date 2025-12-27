// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import logoSrc from "./assets/logo.png";
import { apiFetch, setAuth, getUser, getToken, clearAuth } from "./lib/api";

import AdvogadosPage from "./pages/Advogados";
import PagamentosPage from "./pages/Pagamentos";
import UsuariosPage from "./pages/Usuarios";
import ModeloDistribuicaoPage from "./pages/ModeloDistribuicao";
import ClientesPage from "./pages/Clientes";
import ContratoPage from "./pages/Contrato";

/* ---------------- clock ---------------- */
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
  };
}

/* ---------------- placeholders ---------------- */
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
      className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

/* ---------------- Login ---------------- */
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
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-center mb-5">
          <img src={logoSrc} alt="AMR" className="h-8" />
        </div>

        <div className="text-lg font-semibold text-slate-900 text-center">Entrar</div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <label className="text-sm font-semibold text-slate-700">E-mail</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="seu@email.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Senha</label>
            <input
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
            />
          </div>

          {error ? (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-700 text-white px-3 py-2 font-semibold hover:bg-blue-800 disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Shell ---------------- */
function Shell({ user, onLogout }) {
  const clock = useClock();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = String(user?.role || "").toUpperCase() === "ADMIN";
  const [openSettings, setOpenSettings] = useState(false);
  const [openLivroCaixa, setOpenLivroCaixa] = useState(false);

  const menu = useMemo(() => {
    if (!isAdmin) return [];

    return [
      { to: "/dashboard", label: "Dashboard" },

      // ✅ Pagamentos entre Dashboard e Repasses
      { to: "/pagamentos", label: "Pagamentos" },

      { to: "/repasses", label: "Repasses" },

      {
        type: "group",
        label: "Livro Caixa",
        children: [
          { to: "/livro-caixa/lancamentos", label: "Lançamentos" }, // sem expand/retrai
          { to: "/livro-caixa/visualizacao", label: "Visualização" },
          { to: "/livro-caixa/emissao", label: "Emissão" },
        ],
      },

      { type: "group", label: "Configurações", children: [
       { to: "/advogados", label: "Advogados" },
        { to: "/clientes", label: "Clientes" },
        { to: "/usuarios", label: "Usuários" },
        { to: "/modelo-distribuicao", label: "Modelo de Distribuição" },
      ]},

      { to: "/historico", label: "Histórico" },
      { to: "/relatorios", label: "Relatórios" },
    ];
  }, [isAdmin]);

  const navClass = ({ isActive }) =>
    `block rounded-lg px-4 py-2 text-sm transition-colors ${
      isActive ? "bg-blue-200 text-blue-950 font-semibold" : "text-slate-700 hover:bg-blue-50"
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed left-0 top-0 w-64 h-screen bg-slate-50 border-r border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-200 text-center">
          <img src={logoSrc} alt="AMR" className="h-7 mx-auto" />
        </div>

        <nav className="p-3 space-y-2 flex-1 overflow-auto">
          {menu.map((item) => {
            if (item.type === "group") {
              const opened = item.label === "Configurações" ? openSettings : openLivroCaixa;
              const toggle = item.label === "Configurações" ? setOpenSettings : setOpenLivroCaixa;

              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggle((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    <span>{item.label}</span>
                    <Chevron open={opened} />
                  </button>

                  {opened ? (
                    <div className="mt-1 ml-2 space-y-1">
                      {item.children.map((ch) => (
                        <NavLink key={ch.to} to={ch.to} className={navClass}>
                          {ch.label}
                        </NavLink>
                      ))}
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

        <div className="p-4 border-t border-slate-200 text-sm">
          <div className="flex justify-between font-semibold text-slate-700">
            <span>{clock.date}</span>
            <span>{clock.time}</span>
          </div>

          {/* ✅ Usuário logado e tipo entre data/hora e sair */}
          <div className="px-3 py-2 text-xs text-slate-600">
            <div className="font-semibold text-slate-800">{user?.nome || "—"}</div>
            <div>
              {String(user?.tipoUsuario || "").toUpperCase() || "—"}
              {user?.role ? ` • ${String(user.role).toUpperCase()}` : ""}
            </div>
          </div>

          <button
            onClick={() => {
              clearAuth();
              onLogout?.();
              navigate("/");
            }}
            className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold hover:bg-slate-100"
          >
            Sair
          </button>
        </div>
      </aside>

      <main className="ml-64 h-screen overflow-y-auto">
        <Routes>
          <Route path="/dashboard" element={<Placeholder title="Dashboard" />} />
          <Route path="/pagamentos" element={<PagamentosPage user={user} />} />
          <Route path="/repasses" element={<Placeholder title="Repasses" />} />
          <Route path="/contratos/:id" element={<ContratoPage user={user} />} />
          
          <Route path="/livro-caixa/lancamentos" element={<Placeholder title="Livro Caixa — Lançamentos" />} />
          <Route path="/livro-caixa/visualizacao" element={<Placeholder title="Livro Caixa — Visualização" />} />
          <Route path="/livro-caixa/emissao" element={<Placeholder title="Livro Caixa — Emissão" />} />

          <Route path="/advogados" element={<AdvogadosPage user={user} />} />
          <Route path="/clientes" element={<ClientesPage user={user} />} />
          <Route path="/usuarios" element={<UsuariosPage user={user} />} />

          {/* ✅ CORRIGIDO */}
          <Route path="/modelo-distribuicao" element={<ModeloDistribuicaoPage user={user} />} />

          <Route path="/historico" element={<Placeholder title="Histórico" />} />
          <Route path="/relatorios" element={<Placeholder title="Relatórios" />} />
          <Route path="*" element={<Placeholder title="Página não encontrada" />} />
        </Routes>
      </main>
    </div>
  );
}

/* ---------------- App root ---------------- */
export default function App() {
  const [user, setUser] = useState(() => getUser());
  const token = getToken();

  useEffect(() => {
    if (!token) return;
    // opcional: refresh do user
  }, [token]);

  if (!token || !user) {
    return <Login onLogin={(u) => setUser(u)} />;
  }

  return <Shell user={user} onLogout={() => setUser(null)} />;
}
