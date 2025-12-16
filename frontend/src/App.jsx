import { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import logoSrc from "./assets/logo.png";
import { apiFetch, clearAuth } from "./lib/api";
import RestTimer from "./components/RestTimer";

/* =========================
   Auth helpers
========================= */

function useAuth() {
  const [auth, setAuth] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("auth"));
    } catch {
      return null;
    }
  });

  function logout() {
    clearAuth();
    setAuth(null);
    window.location.href = "/login";
  }

  return { auth, setAuth, logout };
}

function ProtectedRoute({ children }) {
  const auth = JSON.parse(localStorage.getItem("auth"));
  if (!auth?.token) return <Navigate to="/login" replace />;
  return children;
}

/* =========================
   Views
========================= */

const VIEWS = {
  DASHBOARD: { label: "Dashboard", path: "/dashboard", roles: ["ADMIN", "USER"] },
  PAGAMENTOS: { label: "Pagamentos", path: "/pagamentos", roles: ["ADMIN"] },
  REPASSES: { label: "Repasses", path: "/repasses", roles: ["ADMIN", "USER"] },
  ADVOGADOS: { label: "Advogados", path: "/advogados", roles: ["ADMIN"] },
  CLIENTES: { label: "Clientes", path: "/clientes", roles: ["ADMIN"] },
  HISTORICO: { label: "Histórico", path: "/historico", roles: ["ADMIN", "USER"] },
  REPORTS: { label: "Relatórios", path: "/reports", roles: ["ADMIN", "USER"] },
  SETTINGS: { label: "Configurações", path: "/settings", roles: ["ADMIN"] },
};

/* =========================
   Sidebar
========================= */

function Sidebar({ auth, onLogout }) {
  const location = useLocation();
  const role = auth?.user?.role;

  const menu = useMemo(
    () => Object.values(VIEWS).filter(v => v.roles.includes(role)),
    [role]
  );

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const date = now.toLocaleDateString("pt-BR");
  const time = now.toLocaleTimeString("pt-BR");

  return (
    <aside className="fixed inset-y-0 left-0 w-[280px] bg-[#081A33] text-white flex flex-col rounded-r-2xl">
      {/* Logo */}
      <div className="flex flex-col items-center px-6 pt-6 pb-4">
        {/* 🔧 Ajuste a altura aqui */}
        <img src={logoSrc} alt="AMR" className="h-8 w-auto" />

        {/*
        <p className="mt-3 text-2xl font-semibold tracking-wide">
          AMR Advogados
        </p>
        */}
      </div>

      {/* Menu */}
      <nav className="flex-1 px-4 space-y-1 overflow-hidden">
        {menu.map(item => {
          const active = location.pathname === item.path;
          return (
            <a
              key={item.path}
              href={item.path}
              className={`block px-4 py-2 rounded-lg transition ${
                active
                  ? "bg-white text-[#081A33] font-semibold"
                  : "hover:bg-white/10"
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>

      {/* Descanso */}
     {/* <div className="px-4">
        <RestTimer />
      </div>
     */}
      {/* Rodapé */}
      <div className="px-4 pb-4 pt-3 space-y-2 text-sm">
        <div className="flex justify-between font-medium">
          <span className="truncate">{auth?.user?.nome}</span>
          {/* <span>{auth?.user?.role}</span> */}
          {/* <span className="truncate"> */}
            {auth?.user?.nome || "Usuário"}
          </span>
          <span>
            {auth?.user?.role || auth?.role || "—"}
          </span>
        </div>

        <div className="flex justify-between font-mono opacity-80">
          <span>{date}</span>
          <span>{time}</span>
        </div>

        <button
          onClick={onLogout}
          className="w-full mt-2 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}

/* =========================
   Screens
========================= */

const Screen = ({ title }) => (
  <div className="p-6 text-2xl font-semibold">{title}</div>
);

/* =========================
   App shell
========================= */

function AppShell() {
  const { auth, logout } = useAuth();

  if (!auth) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar auth={auth} onLogout={logout} />

      <main className="ml-[280px] min-h-screen">
        <Routes>
          <Route path="/dashboard" element={<Screen title="Dashboard" />} />
          <Route path="/pagamentos" element={<Screen title="Pagamentos" />} />
          <Route path="/repasses" element={<Screen title="Repasses" />} />
          <Route path="/advogados" element={<Screen title="Advogados" />} />
          <Route path="/clientes" element={<Screen title="Clientes" />} />
          <Route path="/historico" element={<Screen title="Histórico" />} />
          <Route path="/reports" element={<Screen title="Relatórios" />} />
          <Route path="/settings" element={<Screen title="Configurações" />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

/* =========================
   Login
========================= */

function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    setErro(null);

    try {
      const resp = await apiFetch("/auth/login", {
        method: "POST",
        body: { email, senha },
      });

      localStorage.setItem("auth", JSON.stringify(resp));
      window.location.href = "/dashboard";
    } catch {
      setErro("Erro no login");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleLogin}
        className="bg-white p-6 rounded-xl shadow w-[320px] space-y-4"
      >
        <h1 className="text-xl font-semibold">Login</h1>

        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />

        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={e => setSenha(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />

        {erro && <p className="text-red-600 text-sm">{erro}</p>}

        <button className="w-full py-2 bg-[#081A33] text-white rounded">
          Entrar
        </button>
      </form>
    </div>
  );
}

/* ========================= */

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
