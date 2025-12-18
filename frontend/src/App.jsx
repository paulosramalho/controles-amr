import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import logoSrc from "./assets/logo.png";
import { apiFetch, setAuth } from "./lib/api";

import AdvogadosPage from "./pages/Configuracoes/Advogados/AdvogadosPage";

/**
 * App.jsx — versão funcional (loga) + ajustes UI:
 * 1) Botão "Entrar" vira "Entrando..." após click (loading state)
 * 2) Texto "Controle de recebimentos, repasses e obrigações internas"
 *    embaixo da logo, centralizados (Login + Sidebar) — agora em 1 linha e mais destaque
 * 3) Sidebar hover mais evidente
 * 4) Rodapé da sidebar: inverte Data/Hora com Usuário/Tipo + aumenta Data/Hora ~2pt
 * 5) NÃO mexer no processo de login: mantido 100% (mesma chamada/apiFetch e payload)
 */

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
  const [isSubmitting, setIsSubmitting] = useState(false); // UI only

  async function submit(e) {
    e.preventDefault();
    if (isSubmitting) return; // evita duplo clique
    setError("");
    setIsSubmitting(true);
    try {
      // ⚠️ Processo de login NÃO ALTERADO:
      // mesma rota, mesma chamada, mesmo payload e mesmo fluxo
      const resp = await apiFetch("/auth/login", {
      // const resp = await apiFetch("/api/auth/login", {
        method: "POST",
        body: { email, senha },
      });
      setAuth(resp.token);
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
          {/* 🔧 Ajuste da altura da logo NO LOGIN:
              altere o "h-10" abaixo (ex.: h-9, h-8, h-11...) */}
          <img src={logoSrc} alt="AMR" className="h-10 w-auto" />

          {/* Texto abaixo da logo: 1 linha, centralizado, mais destaque, mais afastado */}
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

function AppShell({ user, onLogout }) {
  const clock = useClock();
  const navigate = useNavigate();

  const menu = useMemo(
    () => [
      { to: "/dashboard", label: "Dashboard" },
      { to: "/pagamentos", label: "Pagamentos" },
      { to: "/repasses", label: "Repasses" },
      { to: "/advogados", label: "Advogados" },
      { to: "/clientes", label: "Clientes" },
      { to: "/historico", label: "Histórico" },
      { to: "/relatorios", label: "Relatórios" },
      { to: "/configuracoes", label: "Configurações" },
    ],
    []
  );

  useEffect(() => {
    if (location.pathname === "/") navigate("/dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 h-screen bg-slate-50 border-r border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-200">
          <div className="flex flex-col items-center justify-center">
            {/* 🔧 Ajuste da altura da logo NA SIDEBAR:
                altere o "h-7" abaixo (ex.: h-8, h-10...) */}
            <img src={logoSrc} alt="AMR" className="h-7 w-auto" />

            {/* Texto abaixo da logo, centralizado */}
            <div className="mt-3 text-center">
              {/* <div className="text-sm font-semibold text-slate-900">AMR</div> */}
              <div className="text-xs text-slate-500 leading-tight tracking-wide">
                Controle de recebimentos, repasses e obrigações internas
              </div>
            </div>

            {/* Mantido comentado, como já combinado em rodadas anteriores:
            <div className="mt-2 text-center text-base font-semibold text-slate-900">
              AMR Advogados
            </div>
            */}
          </div>
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-auto">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-lg px-4 py-2 text-sm transition-colors
                 ${
                   isActive
                     ? "bg-slate-200 text-slate-900 font-semibold ring-1 ring-slate-200"
                     : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 hover:ring-1 hover:ring-slate-200"
                 }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          {/* INVERTIDO: Data/Hora em cima (maior ~2pt) */}
          <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
            <span>{clock.date}</span>
            <span>{clock.time}</span>
          </div>

          {/* Usuário/Tipo embaixo */}
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

      {/* Conteúdo */}
      <main className="flex-1">
        <Routes>
          <Route path="/dashboard" element={<Placeholder title="Dashboard" />} />
          <Route path="/pagamentos" element={<Placeholder title="Pagamentos" />} />
          <Route path="/repasses" element={<Placeholder title="Repasses" />} />

          <Route path="/advogados" element={<AdvogadosPage auth={auth} />} />

          <Route path="/clientes" element={<Placeholder title="Clientes" />} />
          <Route path="/historico" element={<Placeholder title="Histórico" />} />
          <Route path="/relatorios" element={<Placeholder title="Relatórios" />} />
          <Route path="/configuracoes" element={<Placeholder title="Configurações" />} />
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
    localStorage.removeItem("token");
    localStorage.removeItem("auth");
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return <AppShell user={user} onLogout={handleLogout} />;
}
