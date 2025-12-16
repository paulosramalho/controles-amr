// frontend/src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import logoSrc from "./assets/logo.png";
import RestTimer from "./components/RestTimer";
import { apiFetch, setAuth, clearAuth, getToken, getUser } from "./lib/api";

/* =========================
   HELPERS
========================= */
function cx(...c) {
  return c.filter(Boolean).join(" ");
}

/* =========================
   CONSTANTES DE VIEW
========================= */
const VIEWS = {
  LOGIN: "login",
  DASH: "dashboard",
  PAGAMENTOS: "pagamentos",
  REPASSES: "repasses",
  ADVOGADOS: "advogados",
  CLIENTES: "clientes",
  HISTORICO: "historico",
  REPORTS: "reports",
  SETTINGS: "settings",
};

/* =========================
   APP
========================= */
export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [auth, setAuthState] = useState(() => ({
    token: getToken(),
    user: getUser(),
  }));

  const isAuthed = !!auth?.token;
  const isAdmin = auth?.user?.role === "ADMIN";

  const [view, setView] = useState(() => {
    const p = new URLSearchParams(location.search);
    return p.get("view") || (isAuthed ? VIEWS.DASH : VIEWS.LOGIN);
  });

  /* ===== relógio ===== */
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  const date = now.toLocaleDateString("pt-BR");
  const time = now.toLocaleTimeString("pt-BR");

  /* ===== backend health ===== */
  const [backendOk, setBackendOk] = useState("verificando...");
  useEffect(() => {
    apiFetch("/health")
      .then(() => setBackendOk("ok"))
      .catch(() => setBackendOk("erro"));
  }, []);

  /* ===== navegação ===== */
  function go(v) {
    setView(v);
    const p = new URLSearchParams(location.search);
    p.set("view", v);
    navigate({ search: p.toString() }, { replace: true });
  }

  function logout() {
    clearAuth();
    setAuthState({ token: null, user: null });
    setView(VIEWS.LOGIN);
  }

  function navItem(key, label) {
    const active = view === key;
    return (
      <button
        onClick={() => go(key)}
        className={cx(
          "w-full text-left px-4 py-2 rounded-xl font-semibold transition",
          active
            ? "bg-white text-[#081A33]"
            : "text-white hover:bg-white/10"
        )}
      >
        {label}
      </button>
    );
  }

  /* =========================
     LOGIN
  ========================= */
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function doLogin() {
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: { email, senha },
      });
      setAuth(data.token, data.user);
      setAuthState({ token: data.token, user: data.user });
      go(VIEWS.DASH);
    } catch (e) {
      setError(e.message || "Erro no login");
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 w-[280px] bg-[#081A33] text-white flex flex-col rounded-r-2xl">
        {/* LOGO */}
        <div className="px-6 pt-6 pb-4 flex flex-col items-center">
          <div className="bg-white p-3 rounded-2xl">
            {/* 🔧 Ajuste aqui a altura da logo (h-7 / h-8 / h-9...) */}
            <img src={logoSrc} alt="AMR" className="h-8 w-auto" />
          </div>

          {/*
          🔕 "AMR Advogados️ogados" removido da UI, mas mantido para reativação futura
          <p className="mt-3 text-2xl font-semibold tracking-wide">
            AMR Advogados
          </p>
          */}
        </div>

        {/* MENU */}
        <div className="px-4 space-y-2">
          {isAuthed && (
            <>
              {navItem(VIEWS.DASH, "Dashboard")}
              {isAdmin && navItem(VIEWS.PAGAMENTOS, "Pagamentos")}
              {navItem(VIEWS.REPASSES, "Repasses")}
              {isAdmin && navItem(VIEWS.ADVOGADOS, "Advogados")}
              {isAdmin && navItem(VIEWS.CLIENTES, "Clientes")}
              {navItem(VIEWS.HISTORICO, "Histórico")}
              {navItem(VIEWS.REPORTS, "Relatórios")}
              {isAdmin && navItem(VIEWS.SETTINGS, "Configurações")}
            </>
          )}
        </div>

        {/* espaço elástico */}
        <div className="flex-1" />

        {/* RODAPÉ */}
        <div className="px-4 pb-4 space-y-3">
          {/* Descanso – versão compacta */}
          <RestTimer />

          <div className="text-sm flex justify-between opacity-80">
            <span className="truncate">{auth?.user?.nome || "—"}</span>
            <span className="font-semibold">{auth?.user?.role}</span>
          </div>

          <div className="text-sm flex justify-between font-mono opacity-70">
            <span>{date}</span>
            <span>{time}</span>
          </div>

          <button
            onClick={logout}
            className="w-full mt-2 rounded-xl border border-white/20 py-2 hover:bg-white/10"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* CONTEÚDO */}
      <main className="ml-[280px] flex-1 p-6">
        {!isAuthed && view === VIEWS.LOGIN && (
          <div className="max-w-sm mx-auto mt-20 bg-white p-6 rounded-2xl shadow">
            <h2 className="text-lg font-semibold mb-4">Login</h2>

            <input
              className="w-full border rounded-xl px-3 py-2 mb-3"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              className="w-full border rounded-xl px-3 py-2 mb-3"
              type="password"
              placeholder="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              onClick={doLogin}
              disabled={loading}
              className="w-full mt-4 bg-[#081A33] text-white py-2 rounded-xl"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </div>
        )}

        {isAuthed && (
          <div className="text-slate-700">
            <h1 className="text-xl font-semibold capitalize">{view}</h1>
            <p className="text-sm mt-2">
              Backend:{" "}
              <strong>{backendOk}</strong>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
