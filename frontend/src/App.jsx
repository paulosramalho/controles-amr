import React, { useEffect, useMemo, useState } from "react";
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
function formatCpfCnpj(value = "") {
  const d = onlyDigits(value);

  // CPF
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4")
      .slice(0, 14);
  }

  // CNPJ
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5")
    .slice(0, 18);
}

/** CPF validação */
function isValidCPF(cpfRaw) {
  const cpf = onlyDigits(cpfRaw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;

  return d2 === Number(cpf[10]);
}

/** CNPJ validação */
function isValidCNPJ(cnpjRaw) {
  const cnpj = onlyDigits(cnpjRaw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  const calc = (base) => {
    const weights =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += Number(base[i]) * weights[i];
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

  if (d.length === 11) {
    return isValidCPF(d) ? { ok: true, type: "cpf", msg: "" } : { ok: false, type: "cpf", msg: "CPF inválido" };
  }
  if (d.length === 14) {
    return isValidCNPJ(d) ? { ok: true, type: "cnpj", msg: "" } : { ok: false, type: "cnpj", msg: "CNPJ inválido" };
  }
  return { ok: false, type: null, msg: "Documento inválido" };
}

/** Telefone (Diretriz 7): (99) 9 9999-9999 */
function formatTelefoneBR(value = "") {
  const d = onlyDigits(value).slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}

function validateTelefoneBR(value = "") {
  const d = onlyDigits(value);
  if (!d) return { ok: true, msg: "" }; // opcional por enquanto
  if (d.length !== 11) return { ok: false, msg: "Telefone incompleto" };
  return { ok: true, msg: "" };
}

/** Datas: sempre DD/MM/AAAA na exibição */
function formatDateBR(date) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Valores (R$):
 * digitando: 1->0,01; 12->0,12; 123->1,23; 123456->1.234,56
 */
function formatMoneyTyping(value = "") {
  const digits = onlyDigits(value);
  if (!digits) return "";
  const number = Number(digits) / 100;
  return number.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoneyBRL(value = "") {
  const v = String(value || "").trim();
  if (!v) return null;
  // "1.234,56" -> 1234.56
  const normalized = v.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function moneyBRL(value) {
  if (value == null || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Hora: HH:MM:SS */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    now, // ✅ mantém Date disponível (útil p/ [TEMP-REST])
    date: `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
  };
}

/** =========================
 *  [TEMP-REST] DESCANSO — TEMPORÁRIO (REMOVER AO FINAL)
 *  - Correção principal: quando diff<=0, NÃO resetar step a cada tick
 *  - Usa trava restFiredAt para disparar UMA vez por alvo
 *  ========================= */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function parseTimeToHMS(timeStr = "") {
  const parts = String(timeStr).split(":").map((x) => Number(x));
  if (parts.length < 2) return null;
  const [h, m, s = 0] = parts;
  if ([h, m, s].some((n) => Number.isNaN(n))) return null;
  if (h < 0 || h > 23) return null;
  if (m < 0 || m > 59) return null;
  if (s < 0 || s > 59) return null;
  return { h, m, s };
}

function buildNextTargetDate(timeStr, now = new Date()) {
  const hms = parseTimeToHMS(timeStr);
  if (!hms) return null;

  const target = new Date(now);
  target.setHours(hms.h, hms.m, hms.s, 0);

  // se já passou hoje, agenda para amanhã
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target;
}

function msToHHMMSS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/** =========================
 *  UI COMPONENTS
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
      <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 16v-6M12 16V8M16 16v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  lock: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" {...props}>
      <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 11h12v9H6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  settings: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" {...props}>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" />
      <path
        d="M19.4 15a7.97 7.97 0 0 0 .1-3l2-1.2-2-3.5-2.3.7a7.8 7.8 0 0 0-2.6-1.5L12 2 9.4 6.5A7.8 7.8 0 0 0 6.8 8l-2.3-.7-2 3.5 2 1.2a8 8 0 0 0 0 3l-2 1.2 2 3.5 2.3-.7c.8.7 1.7 1.2 2.6 1.5L12 22l2.6-4.5c.9-.3 1.8-.8 2.6-1.5l2.3.7 2-3.5-2-1.2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

function Badge({ tone = "slate", children }) {
  const map = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-800 border-blue-200",
    green: "bg-emerald-50 text-emerald-800 border-emerald-200",
    red: "bg-red-50 text-red-800 border-red-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
  };
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", map[tone])}>
      {children}
    </span>
  );
}

function Card({ title, subtitle, children, right }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      {(title || right) && (
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
            {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Input({ label, hint, error, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-slate-700">{label}</span>}
      <input
        {...props}
        className={cx(
          "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none",
          "focus:ring-2 focus:ring-blue-100",
          error ? "border-red-300 focus:border-red-300 focus:ring-red-100" : "focus:border-blue-300",
          props.className
        )}
      />
      {error ? (
        <span className="mt-1 block text-[11px] text-red-700">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

function Select({ label, hint, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-xs font-medium text-slate-700">{label}</span>}
      <select
        {...props}
        className={cx(
          "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none",
          "focus:border-blue-300 focus:ring-2 focus:ring-blue-100",
          props.className
        )}
      >
        {props.children}
      </select>
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

function Button({ variant = "primary", children, ...props }) {
  const base = "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition shadow-sm";
  const variants = {
    primary: "bg-blue-900 text-white hover:bg-blue-800 focus:ring-2 focus:ring-blue-200",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
  };
  return (
    <button
      {...props}
      className={cx(base, variants[variant], props.disabled && "opacity-60 cursor-not-allowed", props.className)}
    >
      {children}
    </button>
  );
}

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-white/80 backdrop-blur">
      <div className="rounded-2xl border bg-white px-6 py-5 shadow-sm text-center">
        <img src={logoSrc} alt="AMR Advogados" className="mx-auto h-10 w-auto max-w-[240px] object-contain" />
        <p className="mt-3 text-sm font-medium text-slate-900">Carregando…</p>
        <p className="mt-1 text-xs text-slate-500">Conectando ao backend</p>
      </div>
    </div>
  );
}

function saudacaoPorHorario(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite"; // 18:00–04:59
}

/** =========================
 *  APP
 *  ========================= */

export default function App() {
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const clock = useClock();

  const [view, setView] = useState("create");

  const viewTitle = useMemo(
    () => ({
      create: "Cadastro rápido",
      list: "Clientes & Ordens",
      dashboard: "Dashboard financeiro",
    }),
    []
  );

  const [backend, setBackend] = useState({ loading: true, label: "verificando" });

  useEffect(() => {
    let alive = true;
    async function ping() {
      setBackend({ loading: true, label: "verificando" });
      try {
        const r = await fetch(`${API_BASE}/api/health`);
        if (!alive) return;
        setBackend({ loading: false, label: r.ok ? "ok" : "erro" });
      } catch {
        if (!alive) return;
        setBackend({ loading: false, label: "erro" });
      }
    }
    ping();
    return () => {
      alive = false;
    };
  }, [API_BASE]);

  const [form, setForm] = useState({
    cpfCnpj: "",
    nomeRazaoSocial: "",
    email: "",
    telefone: "",
    descricao: "",
    tipoContrato: "",
    valorTotalPrevisto: "", // string mascarada
    modeloPagamento: "AVISTA",
    dataInicio: "", // yyyy-mm-dd (input date)
  });

  const [docTouched, setDocTouched] = useState(false);
  const docValidation = useMemo(() => validateCpfCnpj(form.cpfCnpj), [form.cpfCnpj]);
  const docError = docTouched && !docValidation.ok ? docValidation.msg : "";

  // ✅ Telefone: validação básica (11 dígitos) — Diretriz 7
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneValidation = useMemo(() => validateTelefoneBR(form.telefone), [form.telefone]);
  const phoneError = phoneTouched && !phoneValidation.ok ? phoneValidation.msg : "";

  const [createStatus, setCreateStatus] = useState({ type: "idle", msg: "" });

  const [filters, setFilters] = useState({ q: "", status: "ALL" });
  const [listState, setListState] = useState({ loading: false, error: "", data: [] });

  const [dashState, setDashState] = useState({ loading: false, error: "", data: null });

  // [TEMP-REST] -------------------------------------------------
  // DESCANSO (TEMPORÁRIO) — tudo aqui será removido ao final
  // -------------------------------------------------------------
  const [restTime, setRestTime] = useState(""); // HH:MM:SS
  const [restTarget, setRestTarget] = useState(null); // Date
  const [restCountdown, setRestCountdown] = useState("00:00:00");
  const [restModalOpen, setRestModalOpen] = useState(false);
  const [restModalStep, setRestModalStep] = useState("prompt"); // prompt | postpone | goodnight
  const [restPostponeTime, setRestPostponeTime] = useState("");
  const [restFiredAt, setRestFiredAt] = useState(null); // trava para não re-disparar

  useEffect(() => {
    if (!restTarget) return;

    const tick = () => {
      const n = new Date();
      const diff = restTarget.getTime() - n.getTime();
      setRestCountdown(msToHHMMSS(diff));

      // ✅ dispara só uma vez por alvo e NÃO reseta o step a cada segundo
      if (diff <= 0 && !restFiredAt) {
        setRestFiredAt(n);
        setRestModalOpen(true);
        setRestModalStep("prompt");
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [restTarget, restFiredAt]);
  // [/TEMP-REST] -----------------------------------------------

  async function createClientAndOrder() {
    setDocTouched(true);
    setPhoneTouched(true);

    if (!docValidation.ok) {
      setCreateStatus({ type: "error", msg: "CPF/CNPJ inválido. Corrija para salvar." });
      return;
    }
    if (!phoneValidation.ok) {
      setCreateStatus({ type: "error", msg: "Telefone inválido. Corrija para salvar." });
      return;
    }

    const valor = parseMoneyBRL(form.valorTotalPrevisto);

    setCreateStatus({ type: "loading", msg: "" });

    try {
      const payload = {
        cpfCnpj: onlyDigits(form.cpfCnpj), // envia SEM máscara (correto)
        nomeRazaoSocial: form.nomeRazaoSocial?.trim(),
        email: form.email?.trim() || null,
        telefone: onlyDigits(form.telefone || "") || null, // ✅ envia só números

        ordem: {
          descricao: form.descricao?.trim() || null,
          tipoContrato: form.tipoContrato?.trim() || null,
          valorTotalPrevisto: valor == null ? null : String(valor),
          modeloPagamento: form.modeloPagamento,
          dataInicio: form.dataInicio ? new Date(form.dataInicio).toISOString() : new Date().toISOString(),
        },
      };

      const r = await fetch(`${API_BASE}/api/clients-and-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || "Falha ao criar cliente + ordem");

      setCreateStatus({
        type: "success",
        msg: `Criado! Cliente #${j?.cliente?.id ?? "?"}, Ordem #${j?.ordem?.id ?? "?"} (seq. ${j?.ordem?.sequenciaCliente ?? "?"})`,
      });

      setForm((p) => ({ ...p, descricao: "", tipoContrato: "", valorTotalPrevisto: "" }));
    } catch (e) {
      setCreateStatus({ type: "error", msg: e?.message || "Erro inesperado" });
    }
  }

  async function loadClientsWithOrders() {
    setListState((s) => ({ ...s, loading: true, error: "" }));

    const qs = new URLSearchParams();
    if (filters.q?.trim()) qs.set("q", filters.q.trim());
    if (filters.status && filters.status !== "ALL") qs.set("status", filters.status);

    try {
      const r = await fetch(`${API_BASE}/api/clients-with-orders?${qs.toString()}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || "Erro ao listar clientes + ordens");
      setListState({ loading: false, error: "", data: Array.isArray(j) ? j : [] });
    } catch (e) {
      setListState({ loading: false, error: e?.message || "Erro ao listar", data: [] });
    }
  }

  async function loadDashboard() {
    setDashState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const r = await fetch(`${API_BASE}/api/dashboard/summary`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || "Erro ao carregar dashboard");
      setDashState({ loading: false, error: "", data: j });
    } catch (e) {
      setDashState({ loading: false, error: e?.message || "Erro ao carregar dashboard", data: null });
    }
  }

  useEffect(() => {
    if (view === "list") loadClientsWithOrders();
    if (view === "dashboard") loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const navItem = (key, label, icon) => (
    <button
      onClick={() => setView(key)}
      className={cx(
        "w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition flex items-center gap-2",
        view === key ? "bg-blue-900 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"
      )}
    >
      <span className={cx("opacity-90", view === key ? "text-white" : "text-slate-500")}>{icon}</span>
      <span>{label}</span>
    </button>
  );

  if (backend.loading) return <LoadingOverlay />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
        <div className="w-full px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logoSrc}
              alt="AMR Advogados"
              className="h-10 w-auto max-w-[240px] object-contain"
              title="AMR Advogados"
            />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold leading-tight truncate">AMR Advogados</h1>
              <p className="text-xs text-slate-500 truncate">
                Controle de recebimentos, repasses e obrigações internas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge tone="blue">{viewTitle[view] || "Módulo"}</Badge>
            <Badge tone={backend.label === "ok" ? "green" : backend.label === "erro" ? "red" : "amber"}>
              Backend: {backend.label}
            </Badge>
          </div>
        </div>
      </header>

      {/* Content grid */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 py-6">
        {/* Sidebar */}
        <aside className="pl-0 lg:pl-0">
          <div className="sticky top-[92px]">
            <div className="ml-4 lg:ml-4 rounded-2xl border bg-white shadow-sm p-4 flex flex-col h-[calc(100vh-140px)]">
              <div className="mb-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Operacional</p>
              </div>

              <div className="space-y-2 flex-1">
                {navItem("create", "Cadastro rápido", <Icon.plus />)}
                {navItem("list", "Clientes & Ordens", <Icon.list />)}
                {navItem("dashboard", "Dashboard financeiro", <Icon.chart />)}

                <div className="mt-5">
                  <p className="mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Administrativo
                  </p>

                  <div className="space-y-2">
                    <button
                      disabled
                      className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium flex items-center gap-2 border bg-slate-50 text-slate-400 cursor-not-allowed"
                      title="Disponível quando o login estiver ativo"
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

                {/* [TEMP-REST] DESCANSO — TEMPORÁRIO (REMOVER AO FINAL) */}
                <div className="mt-5 rounded-2xl border bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Descanso (temporário)
                  </p>

                  <div className="mt-2 space-y-2">
                    <label className="block">
                      <span className="block text-xs font-medium text-slate-700">Hora de descansar</span>
                      <input
                        type="time"
                        step="1"
                        value={restTime}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRestTime(v);

                          const next = buildNextTargetDate(v, new Date());
                          setRestTarget(next);

                          // rearmar disparo para o novo alvo
                          setRestFiredAt(null);

                          // se estava em modal, fecha (novo alvo)
                          setRestModalOpen(false);
                          setRestModalStep("prompt");
                        }}
                        className={cx(
                          "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none",
                          "focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        )}
                      />
                      <span className="mt-1 block text-[11px] text-slate-500">
                        Tudo aqui é temporário e será removido ao final.
                      </span>
                    </label>

                    <div className="rounded-xl border bg-white px-3 py-2">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Hora escolhida</span>
                        <span className="font-mono text-slate-900">
                          {restTarget
                            ? `${pad2(restTarget.getHours())}:${pad2(restTarget.getMinutes())}:${pad2(
                                restTarget.getSeconds()
                              )}`
                            : "—"}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                        <span>Regressivo</span>
                        <span className="font-mono text-slate-900">{restTarget ? restCountdown : "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* [/TEMP-REST] */}
              </div>

              {/* Sidebar footer: DATA (DD/MM/AAAA) + HORA (HH:MM:SS) */}
              <div className="mt-4 border-t pt-3 space-y-3 text-xs text-slate-600">
                <div className="flex items-center justify-between font-mono">
                  <span>{clock.date}</span>
                  <span>{clock.time}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Usuário</span>
                  <Badge tone="slate">Em desenvolvimento</Badge>
                </div>

                <button
                  disabled
                  className="w-full rounded-xl border px-3 py-2 text-center text-xs font-medium text-slate-400 cursor-not-allowed bg-slate-50"
                  title="Disponível quando o login estiver ativo"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="pr-6 pl-4 lg:pl-0">
          {view === "create" && (
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
                        value={form.cpfCnpj}
                        onChange={(e) => setForm((p) => ({ ...p, cpfCnpj: formatCpfCnpj(e.target.value) }))}
                        onBlur={() => setDocTouched(true)}
                        error={docError}
                        hint={!docError ? "Máscara automática + validação" : undefined}
                      />

                      <Input
                        label="Nome / Razão Social"
                        placeholder="Ex.: Empresa X Ltda."
                        value={form.nomeRazaoSocial}
                        onChange={(e) => setForm((p) => ({ ...p, nomeRazaoSocial: e.target.value }))}
                      />

                      <Input
                        label="E-mail"
                        placeholder="financeiro@empresa.com"
                        value={form.email}
                        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      />

                      {/* ✅ TELEFONE COM MÁSCARA + VALIDAÇÃO (Diretriz 7) */}
                      <Input
                        label="Telefone"
                        placeholder="(99) 9 9999-9999"
                        value={form.telefone}
                        onChange={(e) => setForm((p) => ({ ...p, telefone: formatTelefoneBR(e.target.value) }))}
                        onBlur={() => setPhoneTouched(true)}
                        error={phoneError}
                        hint={!phoneError ? "Máscara automática (11 dígitos)" : undefined}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Dados da ordem de pagamento</h4>
                      <p className="text-xs text-slate-500">Contrato/ocorrência vinculada ao cliente.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        label="Descrição / Objeto"
                        placeholder="Ex.: Contrato consultivo mensal"
                        value={form.descricao}
                        onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                      />

                      <Input
                        label="Tipo de contrato"
                        placeholder="Ex.: esporádico, recorrente..."
                        value={form.tipoContrato}
                        onChange={(e) => setForm((p) => ({ ...p, tipoContrato: e.target.value }))}
                      />

                      <Input
                        label="Valor total previsto (R$)"
                        placeholder="0,00"
                        inputMode="numeric"
                        value={form.valorTotalPrevisto}
                        onChange={(e) => setForm((p) => ({ ...p, valorTotalPrevisto: formatMoneyTyping(e.target.value) }))}
                        hint="Máscara: 1→0,01 • 12→0,12 • 123→1,23 • 123456→1.234,56"
                      />

                      <Select
                        label="Modelo de pagamento"
                        value={form.modeloPagamento}
                        onChange={(e) => setForm((p) => ({ ...p, modeloPagamento: e.target.value }))}
                      >
                        <option value="AVISTA">À vista</option>
                        <option value="ENTRADA_E_PARCELAS">Entrada + parcelas</option>
                        <option value="APENAS_PARCELAS">Apenas parcelas</option>
                      </Select>

                      <Input
                        label="Data de início"
                        type="date"
                        value={form.dataInicio}
                        onChange={(e) => setForm((p) => ({ ...p, dataInicio: e.target.value }))}
                        className="md:col-span-2"
                        hint="Exibição no app será DD/MM/AAAA (o input date é só para facilitar a seleção)"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <Button onClick={createClientAndOrder} disabled={createStatus.type === "loading"}>
                        {createStatus.type === "loading" ? "Salvando..." : "Salvar cliente + ordem"}
                      </Button>

                      {createStatus.type === "success" && <Badge tone="green">{createStatus.msg}</Badge>}
                      {createStatus.type === "error" && <Badge tone="red">{createStatus.msg}</Badge>}
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Dica" subtitle="Use a Listagem para validar rapidamente os cadastros feitos no Cadastro rápido.">
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setView("list")}>
                    Ir para Listagem
                  </Button>
                  <Button variant="ghost" onClick={() => setView("dashboard")}>
                    Ver Dashboard
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {view === "list" && (
            <div className="space-y-6">
              <Card
                title="Listagem: Clientes & Ordens"
                subtitle="Filtros por nome/CPF/CNPJ e status da ordem."
                right={
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={loadClientsWithOrders}>
                      Atualizar
                    </Button>
                  </div>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <Input
                    label="Busca"
                    placeholder="Nome ou CPF/CNPJ..."
                    value={filters.q}
                    onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                  />
                  <Select
                    label="Status da ordem"
                    value={filters.status}
                    onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="ALL">Todas</option>
                    <option value="ATIVA">Ativas</option>
                    <option value="CONCLUIDA">Concluídas</option>
                    <option value="CANCELADA">Canceladas</option>
                  </Select>

                  <div className="flex items-end">
                    <Button onClick={loadClientsWithOrders} className="w-full">
                      Aplicar filtros
                    </Button>
                  </div>
                </div>

                {listState.loading && <p className="text-sm text-slate-500">Carregando...</p>}
                {listState.error && <p className="text-sm text-red-700">{listState.error}</p>}

                {!listState.loading && !listState.error && listState.data?.length === 0 && (
                  <p className="text-sm text-slate-500">Nenhum cliente encontrado.</p>
                )}

                {!listState.loading && !listState.error && listState.data?.length > 0 && (
                  <div className="overflow-auto rounded-xl border">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 border-b">
                        <tr className="text-left text-xs font-semibold text-slate-600">
                          <th className="px-4 py-3">Cliente</th>
                          <th className="px-4 py-3">CPF/CNPJ</th>
                          <th className="px-4 py-3">Contato</th>
                          <th className="px-4 py-3">Ordens</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listState.data.map((c, idx) => (
                          <tr key={c.id} className={cx("border-b", idx % 2 === 0 ? "bg-white" : "bg-slate-50/40")}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{c.nomeRazaoSocial}</div>
                              <div className="text-xs text-slate-500">ID #{c.id}</div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">{formatCpfCnpj(c.cpfCnpj)}</td>
                            <td className="px-4 py-3">
                              <div className="text-xs text-slate-700">{c.email || "—"}</div>
                              <div className="text-xs text-slate-500">
                                {c.telefone ? formatTelefoneBR(c.telefone) : "—"}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-2">
                                {(c.ordens || []).map((o) => (
                                  <div key={o.id} className="rounded-xl border bg-white px-3 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-sm font-semibold text-slate-900">
                                        {o.descricao || "Ordem sem descrição"}{" "}
                                        <span className="text-xs font-normal text-slate-500">
                                          (seq. {o.sequenciaCliente})
                                        </span>
                                      </div>
                                      <Badge
                                        tone={
                                          o.status === "ATIVA" ? "green" : o.status === "CONCLUIDA" ? "slate" : "amber"
                                        }
                                      >
                                        {o.status}
                                      </Badge>
                                    </div>

                                    <div className="mt-1 text-xs text-slate-600">
                                      {o.tipoContrato ? `${o.tipoContrato} • ` : ""}
                                      {o.valorTotalPrevisto
                                        ? `Previsto: ${moneyBRL(o.valorTotalPrevisto)}`
                                        : "Sem valor previsto"}
                                    </div>

                                    <div className="mt-1 text-[11px] text-slate-500">Início: {formatDateBR(o.dataInicio)}</div>
                                  </div>
                                ))}
                                {(c.ordens || []).length === 0 && (
                                  <span className="text-xs text-slate-500">Sem ordens</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {view === "dashboard" && (
            <div className="space-y-6">
              <Card
                title="Dashboard financeiro"
                subtitle="Resumo dos cadastros e ordens."
                right={
                  <Button variant="secondary" onClick={loadDashboard}>
                    Atualizar
                  </Button>
                }
              >
                {dashState.loading && <p className="text-sm text-slate-500">Carregando...</p>}
                {dashState.error && <p className="text-sm text-red-700">{dashState.error}</p>}

                {!dashState.loading && !dashState.error && dashState.data && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="rounded-2xl border bg-white p-4">
                      <p className="text-xs text-slate-500">Clientes</p>
                      <p className="mt-1 text-2xl font-semibold">{dashState.data.totalClients ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border bg-white p-4">
                      <p className="text-xs text-slate-500">Ordens</p>
                      <p className="mt-1 text-2xl font-semibold">{dashState.data.totalOrders ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border bg-white p-4">
                      <p className="text-xs text-slate-500">Ativas</p>
                      <p className="mt-1 text-2xl font-semibold">{dashState.data.totalAtivas ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border bg-white p-4">
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
                )}
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* [TEMP-REST] MODAL — TEMPORÁRIO (REMOVER AO FINAL) */}
      {restModalOpen && (
        <div className="fixed inset-0 z-[999] grid place-items-center bg-black/40 backdrop-blur-sm">
          <div className="w-[min(520px,92vw)] rounded-2xl border bg-white shadow-lg">
            <div className="border-b px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Hora de descansar</h3>
              <p className="mt-1 text-xs text-slate-500">Alerta temporário — remover ao final.</p>
            </div>

            <div className="px-5 py-4 space-y-4">
              {restModalStep === "prompt" && (
                <>
                  <p className="text-sm text-slate-800">
                    Chegou a hora escolhida. Você deve ir descansar agora.
                  </p>

                  <div className="rounded-xl border bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <div className="flex justify-between">
                      <span>Agora</span>
                      <span className="font-mono">{clock.time}</span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span>Regressivo</span>
                      <span className="font-mono">{restCountdown}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                    <button
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-900 hover:bg-slate-200"
                      onClick={() => {
                        setRestModalStep("postpone");
                        setRestPostponeTime(restTime || "");
                      }}
                    >
                      Postergar (excepcionalmente)
                    </button>

                    <button
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-blue-900 text-white hover:bg-blue-800"
                      onClick={() => setRestModalStep("goodnight")}
                    >
                      Não, vou descansar
                    </button>
                  </div>
                </>
              )}

              {restModalStep === "postpone" && (
                <>
                  <p className="text-sm text-slate-800">
  {saudacaoPorHorario(clock.now)} 🌙<br />
  Descanse. Depois a gente continua.
</p>

                  <label className="block">
                    <span className="block text-xs font-medium text-slate-700">Nova hora</span>
                    <input
                      type="time"
                      step="1"
                      value={restPostponeTime}
                      onChange={(e) => setRestPostponeTime(e.target.value)}
                      className={cx(
                        "mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none",
                        "focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      )}
                    />
                  </label>

                  <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                    <button
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-900 hover:bg-slate-200"
                      onClick={() => setRestModalStep("prompt")}
                    >
                      Voltar
                    </button>

                    <button
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-blue-900 text-white hover:bg-blue-800"
                      onClick={() => {
                        const next = buildNextTargetDate(restPostponeTime, new Date());
                        if (next) {
                          setRestTime(restPostponeTime);
                          setRestTarget(next);
                          setRestFiredAt(null); // rearmar para o novo alvo
                          setRestModalOpen(false);
                          setRestModalStep("prompt");
                        }
                      }}
                    >
                      Confirmar nova hora
                    </button>
                  </div>
                </>
              )}

              {restModalStep === "goodnight" && (
                <>
                  <p className="text-sm text-slate-800">
                    Boa noite 🌙<br />
                    Descanse. Amanhã a gente continua.
                  </p>

                  <div className="flex justify-end">
                    <button
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-blue-900 text-white hover:bg-blue-800"
                      onClick={() => {
                        // não zerar restFiredAt aqui (senão reabre instantâneo)
                        setRestModalOpen(false);
                      }}
                    >
                      Retornar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* [/TEMP-REST] */}
    </div>
  );
}
