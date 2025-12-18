import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import logoSrc from "./assets/logo.png";
import { apiFetch, setAuth } from "./lib/api";

/**
 * App.jsx — versão funcional (loga) + ajuste pedido:
 * - Sidebar clara (sem azul)
 * - Hover nas opções do menu
 * - Selecionado "invertido" (agora claro, ao invés de escuro)
 * Obs: alteração somente visual na sidebar/itens. Lógica de login mantida.
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

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const resp = await apiFetch("/auth/login", {
        method: "POST",
        body: { email, senha },
      });
      setAuth(resp.token);
      onLogin(resp.user);
    } catch (err) {
      setError(err?.message || "Erro no login");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <img src={logoSrc} alt="AMR" className="h-10 w-auto" />
          <div>
            <div className="text-sm font-semibold text-slate-900">AMR</div>
            <div className="text-xs text-slate-500">
              Controle de recebimentos, repasses e obrigações internas
            </div>
          </div>
        </div>

        <h1 className="text-lg font-semibold text-slate-900">Login</h1>
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
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-slate-900 text-white py-2.5 text-sm font-semibold hover:bg-slate-800 transition"
          >
            Entrar
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
      <div className="mt-2 text-sm text-slate-600">
        Em desenvolvimento.
      </div>
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
    // ao entrar, garante rota inicial
    if (location.pathname === "/") navigate("/dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 h-screen bg-slate-50 border-r border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center justify-center">
            <img src={logoSrc} alt="AMR" className="h-14 w-auto" />
          </div>

          {/* AMR Advogados abaixo da logo (comentado, como você pediu antes em outras rodadas)
          <div className="mt-2 text-center text-base font-semibold text-slate-900">
            AMR Advogados
          </div>
          */}
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
                     : "text-slate-700 hover:bg-white hover:ring-1 hover:ring-slate-200"
                 }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span className="truncate max-w-[160px]">{user?.nome || "—"}</span>
            <span className="font-semibold">{user?.role || "—"}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>{clock.date}</span>
            <span>{clock.time}</span>
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
          <Route path="/advogados" element={<Placeholder title="Advogados" />} />
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
    // setAuth(null) seria ideal aqui, mas mantendo minimalismo para não mexer na lógica do api.js
    localStorage.removeItem("token");
    localStorage.removeItem("auth");
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return <AppShell user={user} onLogout={handleLogout} />;
}
