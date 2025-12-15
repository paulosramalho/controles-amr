import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import logoSrc from "./assets/logo.png";

/** =========================
 *  HELPERS — DIRETRIZES
 *  ========================= */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function onlyDigits(v = "") {
  return String(v).replace(/\D/g, "");
}

/** CPF/CNPJ máscara */
function maskCpfCnpj(value) {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    const cpf = d.padEnd(11, "");
    const a = cpf.slice(0, 3);
    const b = cpf.slice(3, 6);
    const c = cpf.slice(6, 9);
    const e = cpf.slice(9, 11);
    let out = a;
    if (b) out += "." + b;
    if (c) out += "." + c;
    if (e) out += "-" + e;
    return out.replace(/[.\-]$/g, "");
  }
  const cnpj = d.padEnd(14, "");
  const a = cnpj.slice(0, 2);
  const b = cnpj.slice(2, 5);
  const c = cnpj.slice(5, 8);
  const d4 = cnpj.slice(8, 12);
  const e = cnpj.slice(12, 14);
  let out = a;
  if (b) out += "." + b;
  if (c) out += "." + c;
  if (d4) out += "/" + d4;
  if (e) out += "-" + e;
  return out.replace(/[.\-\/]$/g, "");
}

function isValidCPF(cpfDigits) {
  const cpf = onlyDigits(cpfDigits);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calc = (base) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (base.length + 1 - i);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calc(cpf.slice(0, 9));
  const d2 = calc(cpf.slice(0, 9) + String(d1));
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

function isValidCNPJ(cnpjDigits) {
  const cnpj = onlyDigits(cnpjDigits);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calc = (base) => {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calc(cnpj.slice(0, 12));
  const d2 = calc(cnpj.slice(0, 12) + String(d1));
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

function validateCpfCnpj(value) {
  const d = onlyDigits(value);
  if (!d) return { ok: false, type: null, msg: "Obrigatório" };
  if (d.length < 11) return { ok: false, type: "cpf", msg: "CPF incompleto" };
  if (d.length > 11 && d.length < 14) return { ok: false, type: "cnpj", msg: "CNPJ incompleto" };
  if (d.length === 11) return isValidCPF(d) ? { ok: true, type: "cpf", msg: "" } : { ok: false, type: "cpf", msg: "CPF inválido" };
  if (d.length === 14) return isValidCNPJ(d) ? { ok: true, type: "cnpj", msg: "" } : { ok: false, type: "cnpj", msg: "CNPJ inválido" };
  return { ok: false, type: null, msg: "Documento inválido" };
}

/** Telefone (99) 9 9999-9999 */
function maskTelefoneBR(value) {
  const d = onlyDigits(value).slice(0, 11);
  const a = d.slice(0, 2);
  const b = d.slice(2, 3);
  const c = d.slice(3, 7);
  const e = d.slice(7, 11);
  let out = "";
  if (a) out += `(${a})`;
  if (b) out += ` ${b}`;
  if (c) out += ` ${c}`;
  if (e) out += `-${e}`;
  return out.trim();
}

/** Datas: DD/MM/AAAA */
function toISOFromBR(br) {
  const v = (br || "").trim();
  if (!v) return "";
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function toBRFromISO(iso) {
  if (!iso) return "";
  const s = String(iso);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
}

/** Moeda (R$) - digitando 1=>0,01 etc */
function moneyToDigits(input) {
  const d = onlyDigits(input);
  return d;
}

function digitsToMoneyBRL(digits) {
  const d = String(digits || "").replace(/\D/g, "");
  const n = Number(d || "0");
  const cents = n % 100;
  const int = Math.floor(n / 100);

  const intStr = String(int).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const centsStr = String(cents).padStart(2, "0");
  return `${intStr},${centsStr}`;
}

function moneyBRL(value) {
  if (value == null) return "0,00";
  const s = String(value).replace(".", ",");
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(s)) return s;
  const n = Number(String(value).replace(",", "."));
  if (Number.isNaN(n)) return "0,00";
  const fixed = n.toFixed(2).replace(".", ",");
  const parts = fixed.split(",");
  const intStr = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${intStr},${parts[1]}`;
}

/** Relógio: DD/MM/AAAA + HH:MM:SS */
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
    hours: d.getHours(),
  };
}

/** =========================
 *  UI PRIMITIVES
 *  ========================= */

const Icon = {
  plus: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  list: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" {...props}>
      <path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M3.5 6h.5M3.5 12h.5M3.5 18h.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  chart: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" {...props}>
      <path d="M4 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 19H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 15l3-3 3 2 4-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  user: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" {...props}>
      <path
        d="M20 21a8 8 0 0 0-16 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  lock: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" {...props}>
      <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 11h12v10H6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  settings: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" {...props}>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M19.4 15a7.97 7.97 0 0 0 .1-2l2-1.5-2-3.5-2.4.5a8 8 0 0 0-1.7-1L15 3h-6l-.4 2.5a8 8 0 0 0-1.7 1L4.5 6l-2 3.5L4.5 11a7.97 7.97 0 0 0 .1 2L2.5 14.5l2 3.5 2.4-.5a8 8 0 0 0 1.7 1L9 21h6l.4-2.5a8 8 0 0 0 1.7-1l2.4.5 2-3.5L19.4 15Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  logout: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" {...props}>
      <path d="M10 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 3v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-800 border-blue-100",
    green: "bg-emerald-50 text-emerald-800 border-emerald-100",
    red: "bg-red-50 text-red-700 border-red-100",
    amber: "bg-amber-50 text-amber-800 border-amber-100",
  };
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", tones[tone] || tones.slate)}>
      {children}
    </span>
  );
}

function Button({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition",
        "bg-blue-900 text-white hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      {children}
    </button>
  );
}

function Card({ title, subtitle, right, children }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="p-5 border-b flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Input({ label, error, hint, className = "", ...props }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700">{label}</span>
      <input
        {...props}
        className={cx(
          "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none",
          "focus:border-blue-300 focus:ring-2 focus:ring-blue-100",
          error ? "border-red-300" : "border-slate-200",
          className
        )}
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
      {hint && !error ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

function LoadingOverlay({ title = "Carregando…", subtitle = "Aguarde" }) {
  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div className="rounded-2xl border bg-white p-6 shadow-sm w-[min(520px,92vw)]">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 grid place-items-center">
            <div className="h-4 w-4 rounded-full border-2 border-blue-200 border-t-blue-900 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** =========================
 *  APP
 *  ========================= */

export default function App() {
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const clock = useClock();
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ Auth state
  const [auth, setAuth] = useState({
    status: "checking", // checking | anon | authed
    token: "",
    user: null, // { id, nome, email, role }
    error: "",
  });

  // ✅ Backend health
  const [backend, setBackend] = useState({ loading: true, label: "verificando" });

  // ✅ Views (módulos) — layout aprovado mantido
  const [view, setView] = useState("dashboard");

  const viewTitle = useMemo(
    () => ({
      create: "Cadastro rápido",
      list: "Clientes & Ordens",
      dashboard: "Dashboard financeiro",
      admin_users: "Usuários (Admin)",
      login: "Login",
    }),
    []
  );

  // ✅ Rotas (permissões e URL)
  const viewToPath = useMemo(
    () => ({
      login: "/login",
      create: "/create",
      list: "/list",
      dashboard: "/dashboard",
      admin_users: "/admin/users",
    }),
    []
  );

  const pathToView = useMemo(() => {
    const p = location.pathname || "/";
    if (p === "/login") return "login";
    if (p === "/create") return "create";
    if (p === "/list") return "list";
    if (p === "/dashboard" || p === "/") return "dashboard";
    if (p.startsWith("/admin/users")) return "admin_users";
    if (p.startsWith("/admin")) return "admin_users";
    return "__unknown__";
  }, [location.pathname]);

  const isAuthed = auth.status === "authed";
  const isAdmin = isAuthed && (auth.user?.role === "ADMIN" || auth.user?.role === "admin");

  // ✅ Sincroniza view <-> URL e aplica permissões (ADMIN x USER)
  useEffect(() => {
    // 1) Se não autenticado: sempre /login
    if (auth.status === "anon") {
      if (location.pathname !== "/login") navigate("/login", { replace: true });
      if (view !== "login") setView("login");
      return;
    }

    // 2) Se autenticado: /login não faz sentido
    if (auth.status === "authed" && location.pathname === "/login") {
      navigate("/dashboard", { replace: true });
      if (view !== "dashboard") setView("dashboard");
      return;
    }

    // 3) Se a rota é desconhecida, normaliza
    if (pathToView === "__unknown__") {
      const target = auth.status === "authed" ? "/dashboard" : "/login";
      navigate(target, { replace: true });
      return;
    }

    // 4) Permissões: USER não entra em /admin
    if (pathToView.startsWith("admin") && !isAdmin) {
      navigate("/dashboard", { replace: true });
      if (view !== "dashboard") setView("dashboard");
      return;
    }

    // 5) Atualiza view a partir da URL
    if (view !== pathToView) setView(pathToView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, auth.user?.role, location.pathname, pathToView]);

  // ✅ Quando o usuário clica no menu, navegamos e o efeito acima sincroniza o view
  const go = (nextView) => {
    const p = viewToPath[nextView] || "/dashboard";
    navigate(p);
  };

  /** =========================
   *  AUTH — bootstrap
   *  ========================= */
  useEffect(() => {
    let alive = true;

    async function run() {
      // health
      try {
        const r = await fetch(`${API_BASE}/api/health`);
        const j = await r.json().catch(() => ({}));
        if (!alive) return;
        setBackend({ loading: false, label: r.ok ? "ok" : "erro", details: j });
      } catch {
        if (!alive) return;
        setBackend({ loading: false, label: "erro" });
      }

      // token local
      const token = localStorage.getItem("amr_token") || "";
      if (!token) {
        if (!alive) return;
        setAuth((s) => ({ ...s, status: "anon", token: "", user: null }));
        return;
      }

      // valida token
      try {
        const r = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.message || "Sessão inválida");

        if (!alive) return;
        setAuth({
          status: "authed",
          token,
          user: j?.user || j, // aceita payload {user:{...}} ou {id,role,...}
          error: "",
        });
      } catch (e) {
        localStorage.removeItem("amr_token");
        if (!alive) return;
        setAuth({ status: "anon", token: "", user: null, error: String(e?.message || "Sessão inválida") });
      }
    }

    run();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE]);

  /** =========================
   *  FORM — Cadastro rápido
   *  ========================= */
  const [form, setForm] = useState({
    cpfCnpj: "",
    nomeRazaoSocial: "",
    email: "",
    telefone: "",
    descricao: "",
    tipoContrato: "",
    valorTotalPrevisto: "",
    modeloPagamento: "AVISTA",
    dataInicio: "",
  });

  const [docTouched, setDocTouched] = useState(false);
  const docValidation = useMemo(() => validateCpfCnpj(form.cpfCnpj), [form.cpfCnpj]);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState({ tone: "slate", text: "" });

  async function handleSaveClientOrder() {
    setDocTouched(true);
    const doc = validateCpfCnpj(form.cpfCnpj);
    if (!doc.ok) {
      setSaveMsg({ tone: "red", text: doc.msg });
      return;
    }
    if (!form.nomeRazaoSocial?.trim()) {
      setSaveMsg({ tone: "red", text: "Nome / Razão Social é obrigatório." });
      return;
    }
    if (!form.descricao?.trim()) {
      setSaveMsg({ tone: "red", text: "Descrição / Objeto é obrigatório." });
      return;
    }
    if (!form.valorTotalPrevisto?.trim()) {
      setSaveMsg({ tone: "red", text: "Valor total previsto é obrigatório." });
      return;
    }
    if (!form.dataInicio?.trim()) {
      setSaveMsg({ tone: "red", text: "Data de início é obrigatória." });
      return;
    }

    setSaving(true);
    setSaveMsg({ tone: "slate", text: "" });

    try {
      const payload = {
        cliente: {
          cpfCnpj: onlyDigits(form.cpfCnpj),
          nomeRazaoSocial: form.nomeRazaoSocial.trim(),
          email: form.email?.trim() || null,
          telefone: onlyDigits(form.telefone) || null,
        },
        ordem: {
          descricao: form.descricao.trim(),
          tipoContrato: form.tipoContrato?.trim() || null,
          valorTotalPrevisto: String(form.valorTotalPrevisto).replace(/\D/g, ""),
          modeloPagamento: form.modeloPagamento,
          dataInicio: toISOFromBR(form.dataInicio),
        },
      };

      const r = await fetch(`${API_BASE}/api/clients-and-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || "Erro ao salvar");

      setSaveMsg({ tone: "green", text: "Cliente + Ordem salvos com sucesso." });
      setForm((f) => ({
        ...f,
        descricao: "",
        tipoContrato: "",
        valorTotalPrevisto: "",
        modeloPagamento: "AVISTA",
        dataInicio: "",
      }));
    } catch (e) {
      setSaveMsg({ tone: "red", text: String(e?.message || "Erro ao salvar") });
    } finally {
      setSaving(false);
    }
  }

  /** =========================
   *  LISTAGEM — Clientes + Ordens
   *  ========================= */
  const [filters, setFilters] = useState({ q: "", status: "ALL" });
  const [listState, setListState] = useState({ loading: false, error: "", data: [] });

  async function loadClientsWithOrders() {
    setListState({ loading: true, error: "", data: [] });
    try {
      const qs = new URLSearchParams();
      if (filters.q?.trim()) qs.set("q", filters.q.trim());
      if (filters.status && filters.status !== "ALL") qs.set("status", filters.status);

      const r = await fetch(`${API_BASE}/api/clients-with-orders?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || "Erro ao listar clientes + ordens");
      setListState({ loading: false, error: "", data: Array.isArray(j) ? j : j?.data || [] });
    } catch (e) {
      setListState({ loading: false, error: String(e?.message || "Erro ao listar"), data: [] });
    }
  }

  /** =========================
   *  DASHBOARD
   *  ========================= */
  const [dashState, setDashState] = useState({ loading: false, error: "", data: null });

  async function loadDashboard() {
    setDashState({ loading: true, error: "", data: null });
    try {
      const r = await fetch(`${API_BASE}/api/dashboard/summary`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || "Erro ao carregar dashboard");
      setDashState({ loading: false, error: "", data: j });
    } catch (e) {
      setDashState({ loading: false, error: String(e?.message || "Erro ao carregar"), data: null });
    }
  }

  // carrega dados quando muda view
  useEffect(() => {
    if (!isAuthed) return;
    if (view === "list") loadClientsWithOrders();
    if (view === "dashboard") loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, isAuthed]);

  const navItem = (key, label, icon) => (
    <button
      onClick={() => go(key)}
      className={cx(
        "w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition flex items-center gap-2",
        view === key ? "bg-blue-900 text-white shadow-sm" : "bg-white text-slate-700 hover:bg-slate-50 border"
      )}
    >
      <span className={cx("shrink-0", view === key ? "text-white" : "text-slate-500")}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );

  // login form
  const [loginForm, setLoginForm] = useState({ email: "", senha: "" });
  const [loginState, setLoginState] = useState({ loading: false, error: "" });

  async function doLogin() {
    setLoginState({ loading: true, error: "" });
    try {
      const r = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginForm.email, senha: loginForm.senha }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || "Erro no login");
      if (!j?.token) throw new Error("Token não retornado");

      localStorage.setItem("amr_token", j.token);

      const r2 = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${j.token}` },
      });
      const me = await r2.json().catch(() => ({}));
      if (!r2.ok) throw new Error(me?.message || "Falha ao validar sessão");

      setAuth({ status: "authed", token: j.token, user: me?.user || me, error: "" });
      setLoginState({ loading: false, error: "" });
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setLoginState({ loading: false, error: String(e?.message || "Erro no login") });
    }
  }

  function logout() {
    localStorage.removeItem("amr_token");
    setAuth({ status: "anon", token: "", user: null, error: "" });
    navigate("/login", { replace: true });
  }

  // helper p/ badge do topo: módulo selecionado
  const currentModuleLabel = viewTitle[view] || "Módulo";

  if (backend.loading || auth.status === "checking") {
    return <LoadingOverlay title="Carregando…" subtitle="Conectando e validando sessão" />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 lg:px-6 h-[76px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl border bg-white shadow-sm grid place-items-center overflow-hidden">
              <img src={logoSrc} alt="AMR Advogados" className="h-10 w-auto" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">AMR Advogados</p>
              <p className="text-xs text-slate-500">Controle de recebimentos, repasses e obrigações internas</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge tone="blue">{currentModuleLabel}</Badge>

            <Badge tone={backend.label === "ok" ? "green" : backend.label === "erro" ? "red" : "amber"}>
              Backend: {backend.label}
            </Badge>

            {isAuthed ? (
              <Badge tone="slate">
                {auth.user?.role || "—"} • {auth.user?.email || "—"}
              </Badge>
            ) : (
              <Badge tone="amber">Não logado</Badge>
            )}

            {isAuthed ? (
              <button
                onClick={logout}
                className="ml-2 inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                title="Sair"
              >
                <Icon.logout />
                Sair
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto max-w-7xl px-4 lg:px-6 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 py-6">
        {/* Sidebar (layout aprovado: mantido) */}
        <aside className="pl-0 lg:pl-0">
          <div className="sticky top-[92px]">
            <div className="ml-4 lg:ml-4 rounded-2xl border bg-white shadow-sm p-4 flex flex-col h-[calc(100vh-140px)]">
              <div className="mb-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Operacional</p>
              </div>

              <div className="space-y-2 flex-1">
                {!isAuthed ? (
                  navItem("login", "Login", <Icon.user />)
                ) : (
                  <>
                    {navItem("create", "Cadastro rápido", <Icon.plus />)}
                    {navItem("list", "Listagem (Clientes & Ordens)", <Icon.list />)}
                    {navItem("dashboard", "Dashboard financeiro", <Icon.chart />)}
                  </>
                )}

                {isAuthed && isAdmin && (
                  <div className="mt-5">
                    <p className="mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Administrativo
                    </p>

                    <div className="space-y-2">
                      {navItem("admin_users", "Usuários", <Icon.user />)}

                      <button
                        disabled
                        className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium flex items-center gap-2 border bg-slate-50 text-slate-400 cursor-not-allowed"
                        title="Em breve"
                      >
                        <Icon.lock />
                        Controle de acesso
                      </button>

                      <button
                        disabled
                        className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium flex items-center gap-2 border bg-slate-50 text-slate-400 cursor-not-allowed"
                        title="Em breve"
                      >
                        <Icon.settings />
                        Configurações
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé sidebar: Data/Hora + “Usuário” */}
              <div className="pt-3 border-t flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono">{clock.date}</span>
                <span className="font-mono">{clock.time}</span>
              </div>
              <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                <span>{isAuthed ? "Usuário logado" : "Em desenvolvimento"}</span>
                <span className="font-medium">{isAuthed ? (auth.user?.nome || "—") : "—"}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="space-y-6">
          {!isAuthed && view === "login" && (
            <Card title="Login" subtitle="Entre com seu usuário e senha para acessar o sistema.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="E-mail"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm((s) => ({ ...s, email: e.target.value }))}
                  placeholder="financeiro@amradvogados.com"
                />
                <Input
                  label="Senha"
                  type="password"
                  value={loginForm.senha}
                  onChange={(e) => setLoginForm((s) => ({ ...s, senha: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>

              {loginState.error ? <p className="mt-3 text-sm text-red-600">{loginState.error}</p> : null}

              <div className="mt-4 flex items-center gap-3">
                <Button onClick={doLogin} disabled={loginState.loading}>
                  {loginState.loading ? "Entrando…" : "Entrar"}
                </Button>
              </div>
            </Card>
          )}

          {!isAuthed && view !== "login" && (
            <Card title="Acesso restrito" subtitle="Você precisa fazer login para continuar.">
              <Button onClick={() => go("login")}>Ir para Login</Button>
            </Card>
          )}

          {/* MÓDULOS (só authed) */}
          {isAuthed && view === "create" && (
            <div className="space-y-6">
              <Card
                title="Cadastro rápido: Cliente + Ordem"
                subtitle="Crie um Cliente e uma Ordem de Pagamento em uma única ação."
                right={<Badge tone="slate">API {API_BASE.replace(/^https?:\/\//, "")}</Badge>}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Dados do cliente</h4>
                      <p className="text-xs text-slate-500">CPF/CNPJ, nome e contato principal.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        label="CPF/CNPJ"
                        placeholder="CPF: 000.000.000-00 ou CNPJ: 00.000.000/0000-00"
                        value={maskCpfCnpj(form.cpfCnpj)}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, cpfCnpj: e.target.value }));
                          setDocTouched(true);
                        }}
                        error={docTouched && !docValidation.ok ? docValidation.msg : ""}
                      />

                      <Input
                        label="Telefone"
                        placeholder="(99) 9 9999-9999"
                        value={maskTelefoneBR(form.telefone)}
                        onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                      />

                      <Input
                        label="Nome / Razão Social"
                        placeholder="Ex.: Empresa X Ltda."
                        className="md:col-span-2"
                        value={form.nomeRazaoSocial}
                        onChange={(e) => setForm((f) => ({ ...f, nomeRazaoSocial: e.target.value }))}
                      />

                      <Input
                        label="E-mail"
                        placeholder="financeiro@empresa.com"
                        className="md:col-span-2"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Dados da ordem de pagamento</h4>
                      <p className="text-xs text-slate-500">Detalhes do contrato/ocorrência vinculada ao cliente.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        label="Descrição / Objeto"
                        placeholder="Ex.: Contrato consultivo mensal"
                        className="md:col-span-2"
                        value={form.descricao}
                        onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                      />
                      <Input
                        label="Tipo de contrato"
                        placeholder="Ex.: esporádico, recorrente..."
                        value={form.tipoContrato}
                        onChange={(e) => setForm((f) => ({ ...f, tipoContrato: e.target.value }))}
                      />
                      <Input
                        label="Valor total previsto"
                        placeholder="Ex.: 10000"
                        value={digitsToMoneyBRL(moneyToDigits(form.valorTotalPrevisto))}
                        onChange={(e) => setForm((f) => ({ ...f, valorTotalPrevisto: e.target.value }))}
                        hint="Digite números: 1→0,01 | 123456→1.234,56"
                      />

                      <label className="block">
                        <span className="block text-xs font-medium text-slate-700">Modelo de pagamento</span>
                        <select
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                          value={form.modeloPagamento}
                          onChange={(e) => setForm((f) => ({ ...f, modeloPagamento: e.target.value }))}
                        >
                          <option value="AVISTA">À vista</option>
                          <option value="ENTRADA_E_PARCELAS">Entrada + parcelas</option>
                          <option value="PARCELAS">Parcelas</option>
                        </select>
                      </label>

                      <Input
                        label="Data de início"
                        placeholder="dd/mm/aaaa"
                        value={form.dataInicio}
                        onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))}
                        hint="Formato: DD/MM/AAAA"
                      />
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                      <Button onClick={handleSaveClientOrder} disabled={saving}>
                        {saving ? "Salvando…" : "Salvar cliente + ordem"}
                      </Button>

                      {saveMsg.text ? <Badge tone={saveMsg.tone}>{saveMsg.text}</Badge> : null}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {isAuthed && view === "list" && (
            <div className="space-y-6">
              <Card
                title="Listagem (Clientes & Ordens)"
                subtitle="Filtros básicos para validar rapidamente os cadastros."
                right={<Badge tone="slate">API {API_BASE.replace(/^https?:\/\//, "")}</Badge>}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    label="Busca (cliente / CPF/CNPJ)"
                    placeholder="Digite parte do nome ou documento…"
                    value={filters.q}
                    onChange={(e) => setFilters((s) => ({ ...s, q: e.target.value }))}
                  />

                  <label className="block">
                    <span className="block text-xs font-medium text-slate-700">Status da ordem</span>
                    <select
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      value={filters.status}
                      onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value }))}
                    >
                      <option value="ALL">Todas</option>
                      <option value="ATIVA">Ativas</option>
                      <option value="CONCLUIDA">Concluídas</option>
                    </select>
                  </label>

                  <div className="flex items-end">
                    <Button onClick={loadClientsWithOrders} disabled={listState.loading}>
                      {listState.loading ? "Carregando…" : "Aplicar filtros"}
                    </Button>
                  </div>
                </div>

                {listState.error ? <p className="mt-4 text-sm text-red-600">{listState.error}</p> : null}

                <div className="mt-5 space-y-3">
                  {listState.data?.length ? (
                    listState.data.map((c) => (
                      <div key={c.id} className="rounded-2xl border bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{c.nomeRazaoSocial}</p>
                            <p className="text-xs text-slate-500">
                              {maskCpfCnpj(c.cpfCnpj)} • {c.email || "—"} • {maskTelefoneBR(c.telefone || "") || "—"}
                            </p>
                          </div>
                          <Badge tone={c.ativo ? "green" : "red"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {(c.ordens || []).map((o) => (
                            <div key={o.id} className="rounded-2xl border bg-slate-50 p-3">
                              <p className="text-sm font-semibold text-slate-900">
                                #{o.sequenciaCliente} • {o.descricao}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                Modelo: {o.modeloPagamento} • Início: {toBRFromISO(o.dataInicio)} • Status: {o.status}
                              </p>
                              <p className="text-xs text-slate-500 mt-1">
                                Valor previsto: <span className="font-medium text-slate-700">{moneyBRL(o.valorTotalPrevisto)}</span>
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Nenhum registro encontrado.</p>
                  )}
                </div>
              </Card>
            </div>
          )}

          {isAuthed && view === "dashboard" && (
            <div className="space-y-6">
              <Card
                title="Dashboard financeiro"
                subtitle="Resumo rápido para conferência."
                right={<Badge tone="slate">API {API_BASE.replace(/^https?:\/\//, "")}</Badge>}
              >
                {dashState.loading ? (
                  <p className="text-sm text-slate-500">Carregando…</p>
                ) : dashState.error ? (
                  <p className="text-sm text-red-600">{dashState.error}</p>
                ) : dashState.data ? (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3 rounded-2xl border bg-white p-4">
                      <p className="text-xs text-slate-500">Clientes</p>
                      <p className="mt-1 text-2xl font-semibold">{dashState.data.totalClients ?? 0}</p>
                    </div>

                    <div className="md:col-span-3 rounded-2xl border bg-white p-4">
                      <p className="text-xs text-slate-500">Ordens</p>
                      <p className="mt-1 text-2xl font-semibold">{dashState.data.totalOrders ?? 0}</p>
                    </div>

                    <div className="md:col-span-3 rounded-2xl border bg-white p-4">
                      <p className="text-xs text-slate-500">Ativas</p>
                      <p className="mt-1 text-2xl font-semibold">{dashState.data.totalAtivas ?? 0}</p>
                    </div>

                    <div className="md:col-span-3 rounded-2xl border bg-white p-4">
                      <p className="text-xs text-slate-500">Concluídas</p>
                      <p className="mt-1 text-2xl font-semibold">{dashState.data.totalConcluidas ?? 0}</p>
                    </div>

                    <div className="md:col-span-4 rounded-2xl border bg-white p-4">
                      <p className="text-xs text-slate-500">Valor total previsto</p>
                      <p className="mt-1 text-2xl font-semibold">{moneyBRL(dashState.data.totalValorPrevisto)}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        API base utilizada: <span className="font-mono">{API_BASE}</span>
                      </p>
                    </div>
                  </div>
                ) : null}
              </Card>
            </div>
          )}

          {isAuthed && view === "admin_users" && (
            <div className="space-y-6">
              <Card
                title="Usuários (Admin)"
                subtitle="Gestão de usuários (listar, ativar/desativar e reset de senha) — em construção."
                right={<Badge tone="amber">Em desenvolvimento</Badge>}
              >
                <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-600">
                  <p className="font-medium text-slate-900">Próximos passos</p>
                  <ul className="mt-2 list-disc pl-5 space-y-1">
                    <li>Listar usuários do sistema (ADMIN)</li>
                    <li>Ativar / desativar usuários</li>
                    <li>Resetar senha (enviar token por e-mail)</li>
                  </ul>
                  <p className="mt-3 text-xs text-slate-500">
                    Obs.: esta tela existe só para validar as permissões de rota e a navegação por URL.
                  </p>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
