import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import logoSrc from "./assets/logo.png";
import { apiFetch, setAuth, clearAuth } from "./lib/api";

/* =========================
   Utils
========================= */
function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
  };
}

/* =========================
   Auth Guard
========================= */
function Protected({ children }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

/* =========================
   Pages (placeholders)
========================= */
const Page = ({ title }) => (
  <div className="p-6">
    <h1 className="text-2xl font-semibold">{title}</h1>
  </div>
);

/* =========================
   Login
========================= */
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");

  async function submit(e) {
  e.preventDefault();
  setError("");
  try {
    const resp = await apiFetch("/auth/login", { method: "POST", body: { email, senha } });

    setAuth(resp.token);
    onLogin(resp.user);
  } catch (err) {
    setError(err.message || "Erro no login");
  }
}

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white p-6 rounded-xl shadow"
      >
        <div className="flex flex-col items-center mb-6">
          <img src={logoSrc} alt="AMR" className="h-10 mb-2" />
          <p className="text-sm text-slate-600 text-center">
            Controle de recebimentos, repasses e obrigações internas
          </p>
        </div>

        <label className="block text-sm mb-1">E-mail</label>
        <input
          type="email"
          className="w-full mb-3 rounded border px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label className="block text-sm mb-1">Senha</label>
        <input
          type="password"
          className="w-full mb-4 rounded border px-3 py-2"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />

        {error && (
          <div className="text-red-600 text-sm mb-3">{error}</div>
        )}

        <button
          type="submit"
          className="w-full bg-slate-900 text-white py-2 rounded font-semibold hover:bg-slate-800"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}

/* =========================
   Sidebar
========================= */
function Sidebar({ role, onLogout }) {
  const clock = useClock();

  const items = useMemo(() => {
    const base = [
      { to: "/", label: "Dashboard" },
      { to: "/pagamentos", label: "Pagamentos" },
      { to: "/repasses", label: "Repasses" },
      { to: "/historico", label: "Histórico" },
      { to: "/relatorios", label: "Relatórios" },
    ];
    if (role === "ADMIN") {
      base.splice(3, 0,
        { to: "/advogados", label: "Advogados" },
        { to: "/clientes", label: "Clientes" }
      );
      base.push({ to: "/configuracoes", label: "Configurações" });
    }
    return base;
  }, [role]);

  return (
    <aside className="w-64 h-screen bg-white border-r flex flex-col justify-between">
      <div>
        <div className="flex flex-col items-center py-6">
          {/* ajuste altura da logo aqui */}
          <img src={logoSrc} alt="AMR" className="h-14 mb-2" />
          {/* "AMR Advogados" removido conforme solicitado */}
        </div>

        <nav className="px-3 space-y-1">
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end
              className={({ isActive }) =>
                `block rounded-lg px-4 py-2 text-sm transition
                 ${isActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"}`
              }
            >
              {i.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Rodapé */}
      <div className="px-4 pb-4 space-y-3">
        <div className="text-sm text-slate-600 flex justify-between">
          <span className="truncate">Usuário</span>
          <span className="font-semibold">{role}</span>
        </div>

        <div className="text-xs text-slate-500 flex justify-between">
          <span>{clock.date}</span>
          <span className="font-mono">{clock.time}</span>
        </div>

        <button
          onClick={onLogout}
          className="w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-semibold hover:bg-slate-800"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}

/* =========================
   App
========================= */
export default function App() {
  const [user, setUser] = useState(null);

  function logout() {
    clearAuth();
    setUser(null);
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar role={user.role} onLogout={logout} />

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Page title="Dashboard" />} />
            <Route path="/pagamentos" element={<Page title="Pagamentos" />} />
            <Route path="/repasses" element={<Page title="Repasses" />} />
            <Route path="/historico" element={<Page title="Histórico" />} />
            <Route path="/relatorios" element={<Page title="Relatórios" />} />

            {user.role === "ADMIN" && (
              <>
                <Route path="/advogados" element={<Page title="Advogados" />} />
                <Route path="/clientes" element={<Page title="Clientes" />} />
                <Route
                  path="/configuracoes"
                  element={<Page title="Configurações" />}
                />
              </>
            )}

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
